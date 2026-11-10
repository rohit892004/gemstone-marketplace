import "dotenv/config";
import { randomBytes } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import sharp from "sharp";
import { PrismaClient } from "@/app/generated/prisma/client";
import { computeSellerRating } from "@/lib/admin-catalogue/rating";
import { hashPassword } from "@/lib/auth/password";
import { assertDemoAllowed } from "@/lib/demo/guard";
import { listDemoPhotos, readDemoPhoto } from "@/lib/demo/photos";
import { processMedia } from "@/lib/media/pipeline";
import { getStorageProvider, type StorageProvider } from "@/lib/storage/storage";
import { seedM3Demo } from "@/prisma/seed-m3-demo";

/**
 * Demo catalogue for local development and demos. NEVER runs in production:
 * seedDemo() calls assertDemoAllowed() first, which checks NODE_ENV only.
 *
 * Run with: npm run db:seed:demo   (script: "db:seed:demo": "tsx prisma/seed-demo.ts")
 *
 * Idempotent: removes earlier demo rows (isDemo true, and demo users by email domain) and their
 * stored files, then recreates everything. Requires the reference categories from `db:seed`.
 *
 * Photos are the Pixabay set in prisma/demo-photos (see its README). Listings use only the four stone types
 * that have photos. Sellers get a text monogram logo and a banner photo.
 *
 * Everything here is labelled demo: sellers, listings, reviews and ratings carry isDemo = true,
 * and the UI shows a Demo badge on each. Demo users have unusable random passwords.
 */

export const DEMO_EMAIL_DOMAIN = "demo.gemstone.local";

interface DemoSeller {
  slug: string;
  businessName: string;
  city: string;
  state: string;
  specialties: string[];
  tagline: string;
  yearsInBusiness: number;
  featured: boolean;
  /** Demo photo file used as the seller banner, taken from the seller's main specialty. */
  bannerPhoto: string;
}

const SELLERS: DemoSeller[] = [
  { slug: "himalaya-gem-house", businessName: "Himalaya Gem House", city: "Jaipur", state: "Rajasthan", specialties: ["Sapphire", "Ruby"], tagline: "Heirloom coloured stones cut in Jaipur.", yearsInBusiness: 22, featured: true, bannerPhoto: "sapphire-02.jpg" },
  { slug: "deccan-stone-works", businessName: "Deccan Stone Works", city: "Hyderabad", state: "Telangana", specialties: ["Emerald", "Diamond"], tagline: "Fine green stones and well-cut diamonds.", yearsInBusiness: 11, featured: false, bannerPhoto: "emerald-02.jpg" },
  { slug: "coastal-gem-exchange", businessName: "Coastal Gem Exchange", city: "Mumbai", state: "Maharashtra", specialties: ["Diamond", "Sapphire"], tagline: "Certified diamonds and fine sapphires.", yearsInBusiness: 18, featured: true, bannerPhoto: "diamond-02.jpg" },
  { slug: "surat-colour-co", businessName: "Surat Colour Co", city: "Surat", state: "Gujarat", specialties: ["Ruby", "Emerald"], tagline: "Small parcels, consistent colour.", yearsInBusiness: 7, featured: false, bannerPhoto: "ruby-02.jpg" },
  { slug: "malabar-precious-gems", businessName: "Malabar Precious Gems", city: "Kochi", state: "Kerala", specialties: ["Diamond", "Emerald"], tagline: "Family-run since the 1990s.", yearsInBusiness: 29, featured: false, bannerPhoto: "diamond-03.jpg" },
  { slug: "thar-valley-stones", businessName: "Thar Valley Stones", city: "Udaipur", state: "Rajasthan", specialties: ["Ruby", "Sapphire"], tagline: "Untreated rubies and sapphires from Udaipur.", yearsInBusiness: 9, featured: false, bannerPhoto: "ruby-03.jpg" },
];

/** Species with demo photos. `photos` is the file prefix in prisma/demo-photos (sapphire-01.jpg and so on). */
const SPECIES = [
  { species: "Sapphire", category: "sapphire", photos: "sapphire", colour: "Cornflower blue", origin: "Ceylon", rate: 45000 },
  { species: "Ruby", category: "ruby", photos: "ruby", colour: "Pigeon blood red", origin: "Mozambique", rate: 60000 },
  { species: "Emerald", category: "emerald", photos: "emerald", colour: "Vivid green", origin: "Colombia", rate: 52000 },
  { species: "Diamond", category: "diamond", photos: "diamond", colour: "G colour", origin: "South Africa", rate: 120000 },
  { species: "Sapphire", category: "sapphire", photos: "sapphire", colour: "Padparadscha", origin: "Madagascar", rate: 38000 },
] as const;

const SHAPES = ["Oval", "Cushion", "Round", "Emerald cut", "Pear"] as const;

const REVIEW_BODIES = [
  "Stone matched the photos exactly. Packaging was careful and the paperwork was clear.",
  "Good communication and a fair price for the size. Would buy again.",
  "The colour is even and lively in daylight. A little slow to reply on weekends.",
  "Honest description of inclusions. Took a few days to ship but nothing to complain about.",
  "Helpful advice on setting options. The stone looked better in person.",
  "Bought a pair for earrings. Matched well and arrived insured.",
];

const REVIEW_AUTHORS = ["Ananya R.", "Vikram S.", "Meera K.", "Rohan D.", "Priya N.", "Arjun M.", "Kavya T.", "Sanjay P.", "Ishita G.", "Dev L.", "Neha B.", "Karan J.", "Tara H.", "Aditya V.", "Lakshmi I.", "Farhan Q.", "Divya O.", "Nikhil E."];

/** Minimal PDF with a single empty page. Placeholder only. */
function placeholderPdf(): Buffer {
  const body = [
    "%PDF-1.4",
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >> endobj",
    "trailer << /Root 1 0 R >>",
    "%%EOF",
    "",
  ].join("\n");
  return Buffer.from(body, "latin1");
}

function randomKey(prefix: string, ext: string): string {
  return `${prefix}/${randomBytes(16).toString("hex")}.${ext}`;
}

/** Two capital letters from the first two words of the business name, e.g. "Himalaya Gem House" gives "HG". */
export function monogramInitials(businessName: string): string {
  const words = businessName.split(/\s+/).filter((w) => /[A-Za-z]/.test(w));
  const letters = words.slice(0, 2).map((w) => w.replace(/[^A-Za-z]/g, "")[0] ?? "");
  return letters.join("").toUpperCase();
}

/** Text monogram: cream letters on a charcoal disc with a thin gold ring. Georgia, serif. */
export function monogramSvg(initials: string): string {
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">',
    '<circle cx="256" cy="256" r="256" fill="#1c1a17"/>',
    '<circle cx="256" cy="256" r="232" fill="none" stroke="#8a6d43" stroke-width="5"/>',
    `<text x="256" y="325" text-anchor="middle" font-family="Georgia, serif" font-size="200" fill="#f4f0e8">${initials}</text>`,
    "</svg>",
  ].join("");
}

/** Renders the monogram as a 512 x 512 WebP. */
export async function monogramWebp(businessName: string): Promise<Buffer> {
  return sharp(Buffer.from(monogramSvg(monogramInitials(businessName))), { density: 96 })
    .resize(512, 512)
    .webp({ quality: 90 })
    .toBuffer();
}

/** Deletes earlier demo rows and their stored files. Storage keys are collected before the rows go. */
async function clearDemoData(prisma: PrismaClient, storage: StorageProvider): Promise<void> {
  const oldMedia = await prisma.gemstoneMedia.findMany({
    where: { gemstone: { isDemo: true } },
    select: { fileKey: true, thumbKey: true },
  });
  const oldDocs = await prisma.listingDocument.findMany({
    where: { gemstone: { isDemo: true } },
    select: { fileKey: true },
  });
  const oldSellers = await prisma.sellerProfile.findMany({
    where: { isDemo: true },
    select: { logoKey: true, bannerKey: true },
  });

  await prisma.gemstone.deleteMany({ where: { isDemo: true } });
  await prisma.review.deleteMany({ where: { isDemo: true } });
  await prisma.sellerProfile.deleteMany({ where: { isDemo: true } });
  await prisma.user.deleteMany({ where: { email: { endsWith: `@${DEMO_EMAIL_DOMAIN}` } } });

  for (const m of oldMedia) {
    await storage.delete(m.fileKey);
    if (m.thumbKey) await storage.delete(m.thumbKey);
  }
  for (const d of oldDocs) await storage.delete(d.fileKey);
  for (const s of oldSellers) {
    if (s.logoKey) await storage.delete(s.logoKey);
    if (s.bannerKey) await storage.delete(s.bannerKey);
  }
}

/**
 * Seeds the demo catalogue. Refuses to run when NODE_ENV is production (assertDemoAllowed runs
 * before anything else). Exported so tests can call it with a fake client.
 */
export async function seedDemo(prisma: PrismaClient, storage: StorageProvider = getStorageProvider()): Promise<void> {
  assertDemoAllowed();

  const categories = await prisma.category.findMany({ select: { id: true, slug: true } });
  const categoryBySlug = new Map(categories.map((c) => [c.slug, c.id]));
  for (const s of SPECIES) {
    if (!categoryBySlug.has(s.category)) {
      throw new Error(`Category "${s.category}" is missing. Run "npm run db:seed" first.`);
    }
  }

  await clearDemoData(prisma, storage);

  // Photo sets, listed once. Each image takes the next photo in its set, so pictures change from listing to listing.
  const photoSets = new Map<string, string[]>();
  for (const s of SPECIES) {
    if (!photoSets.has(s.photos)) photoSets.set(s.photos, await listDemoPhotos(s.photos));
  }
  const nextPhoto = new Map<string, number>();

  // 1. Sellers: demo users with unusable random passwords, approved, featured on two.
  const sellerIds: string[] = [];
  for (const [index, s] of SELLERS.entries()) {
    const logoKey = randomKey("demo", "webp");
    await storage.put(logoKey, await monogramWebp(s.businessName));

    const bannerKey = randomKey("demo", "webp");
    const banner = await processMedia(await readDemoPhoto(s.bannerPhoto));
    if (!banner.ok || banner.media.kind !== "IMAGE") throw new Error(`Demo banner failed processing: ${s.bannerPhoto}`);
    await storage.put(bannerKey, banner.media.main.data);

    const user = await prisma.user.create({
      data: {
        email: `${s.slug}@${DEMO_EMAIL_DOMAIN}`,
        name: `Demo owner ${index + 1}`,
        role: "SELLER",
        status: "ACTIVE",
        emailVerifiedAt: new Date(),
        // Dev-only: DEMO_SELLER_PASSWORD lets the end-to-end tests log in as a demo seller.
        // Unset, the password is random and unusable. Production never reaches this (guard above).
        passwordHash: await hashPassword(process.env.DEMO_SELLER_PASSWORD || randomBytes(32).toString("hex")),
        sellerProfile: {
          create: {
            businessName: s.businessName,
            businessType: "PRIVATE_LIMITED",
            addressLine: "Demo address, not a real business location",
            city: s.city,
            state: s.state,
            country: "India",
            yearsInBusiness: s.yearsInBusiness,
            specialties: [...s.specialties],
            // Categories are needed for the requirements board (M3). Connected from the specialties.
            categories: { connect: s.specialties.map((sp) => categoryBySlug.get(sp.toLowerCase())).filter((id): id is string => Boolean(id)).map((id) => ({ id })) },
            tagline: s.tagline,
            logoKey,
            bannerKey,
            approvalStatus: "APPROVED",
            approvedAt: new Date(),
            reviewedAt: new Date(),
            featured: s.featured,
            isDemo: true,
            slug: s.slug,
          },
        },
      },
      select: { sellerProfile: { select: { id: true } } },
    });
    if (!user.sellerProfile) throw new Error("Seller profile was not created");
    sellerIds.push(user.sellerProfile.id);
  }

  // 2. About 40 published listings across the sellers. Some are featured, reserved, sold or on request.
  const now = new Date();
  for (let i = 0; i < 40; i++) {
    const sellerId = sellerIds[i % sellerIds.length];
    const s = SPECIES[i % SPECIES.length];
    const shape = SHAPES[i % SHAPES.length];
    const carat = Math.round((0.8 + ((i * 0.37) % 6)) * 100) / 100;
    const onRequest = i % 9 === 4;
    const priceMinor = onRequest ? null : BigInt(Math.round(carat * s.rate)) * BigInt(100);
    const availability = i % 17 === 0 ? "SOLD" : i % 13 === 0 ? "RESERVED" : "AVAILABLE";
    const title = `${s.colour} ${s.species}, ${carat.toFixed(2)} ct ${shape}`;
    const slug = `demo-${String(i + 1).padStart(2, "0")}-${s.species.toLowerCase()}-${shape.toLowerCase().replace(/\s+/g, "-")}`;

    const imageCount = i % 3 === 0 ? 2 : 1;
    const set = photoSets.get(s.photos) ?? [];
    const media = [];
    for (let n = 0; n < imageCount; n++) {
      const used = nextPhoto.get(s.photos) ?? 0;
      nextPhoto.set(s.photos, used + 1);
      const fileName = set[used % set.length];
      const processed = await processMedia(await readDemoPhoto(fileName));
      if (!processed.ok || processed.media.kind !== "IMAGE") throw new Error(`Demo image failed processing: ${fileName}`);
      const mainKey = randomKey("demo", "webp");
      const thumbKey = randomKey("demo", "webp");
      await storage.put(mainKey, processed.media.main.data);
      await storage.put(thumbKey, processed.media.thumb.data);
      media.push({
        type: "IMAGE" as const,
        fileKey: mainKey,
        thumbKey,
        mimeType: "image/webp",
        sizeBytes: processed.media.sizeBytes,
        width: processed.media.main.width,
        height: processed.media.main.height,
        alt: `${s.colour} ${s.species}, ${carat.toFixed(2)} ct ${shape.toLowerCase()}, detail view ${n + 1}`,
        sortOrder: n,
        isCover: n === 0,
        status: "READY" as const,
      });
    }

    const documents = [];
    if (i % 4 === 0) {
      const pdfKey = randomKey("demo", "pdf");
      const pdf = placeholderPdf();
      await storage.put(pdfKey, pdf);
      documents.push({
        type: "CERTIFICATE" as const,
        title: "Demo certificate (placeholder)",
        fileKey: pdfKey,
        fileName: "demo-certificate.pdf",
        mimeType: "application/pdf",
        sizeBytes: pdf.length,
        isPublic: true,
        verificationStatus: "VERIFIED" as const,
        verifiedAt: now,
      });
    }

    await prisma.gemstone.create({
      data: {
        sellerId,
        categoryId: categoryBySlug.get(s.category),
        title,
        slug,
        species: s.species,
        shape,
        caratWeight: carat.toFixed(2),
        colour: s.colour,
        origin: s.origin,
        description: `Demo listing for ${s.species.toLowerCase()} from ${s.origin}. Sample content only.`,
        quantity: 1,
        priceMinor,
        priceOnRequest: onRequest,
        currency: "INR",
        availability,
        status: "PUBLISHED",
        featured: i === 0 || i === 5,
        isDemo: true,
        submittedAt: now,
        publishedAt: now,
        reviewedAt: now,
        media: { create: media },
        documents: { create: documents },
      },
    });
  }

  // 3. Eighteen approved demo reviews spread across the sellers.
  const ratings = [5, 4, 5, 4, 3, 5, 4, 5, 4, 4, 5, 3, 5, 4, 5, 4, 5, 4];
  await prisma.review.createMany({
    data: ratings.map((rating, i) => ({
      sellerId: sellerIds[i % sellerIds.length],
      authorName: REVIEW_AUTHORS[i % REVIEW_AUTHORS.length],
      rating,
      title: null,
      body: REVIEW_BODIES[i % REVIEW_BODIES.length],
      status: "APPROVED" as const,
      isDemo: true,
      moderatedAt: now,
    })),
  });

  // 4. Recompute each seller's cached rating from APPROVED reviews (same rule as admin moderation).
  for (const sellerId of sellerIds) {
    const approved = await prisma.review.findMany({
      where: { sellerId, status: "APPROVED" },
      select: { rating: true },
    });
    const summary = computeSellerRating(approved.map((r) => r.rating));
    await prisma.sellerProfile.update({
      where: { id: sellerId },
      data: { ratingAverage: summary.ratingAverage, reviewCount: summary.reviewCount },
    });
  }

  console.log(`Demo seed complete: ${SELLERS.length} sellers, 40 listings, ${ratings.length} reviews.`);
}

async function main(): Promise<void> {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
  try {
    await seedDemo(prisma);
    // M3 demo data (conversations, offers, quotations, requirements) attaches to the sellers above.
    await seedM3Demo(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

// Run only when executed directly (npm run db:seed:demo), never when imported by tests.
if (process.argv[1]?.replace(/\\/g, "/").endsWith("prisma/seed-demo.ts")) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
