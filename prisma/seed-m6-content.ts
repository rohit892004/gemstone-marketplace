import "dotenv/config";
import { randomBytes } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import sharp from "sharp";
import { PrismaClient } from "@/app/generated/prisma/client";
import { buildCoverKey } from "@/lib/content/cover";
import { readingMinutes } from "@/lib/content/markdown";
import { slugify, uniqueSlug } from "@/lib/content/status";
import { assertDemoAllowed } from "@/lib/demo/guard";
import { readDemoPhoto } from "@/lib/demo/photos";
import { processMedia } from "@/lib/media/pipeline";
import { getStorageProvider, type StorageProvider } from "@/lib/storage/storage";
import { M6_DEMO_ARTICLES, M6_DEMO_REFERENCE, M6_DEMO_REFERENCE_CATEGORY_SLUGS } from "./seed-m6-content-data";

/**
 * M6 demo content: articles and guides, research notes, five fictional market news items and the gemstone
 * reference library (one page per catalogue category).
 *
 * Run with: npm run db:seed:m6   (needs ALLOW_DEMO_SEED=true, and `npm run db:seed:demo` first so the catalogue
 * categories exist). Refuses to run in production.
 *
 * Idempotent: every row with isDemo=true is deleted and recreated, so a second run gives the same content. Rows
 * that are not demo (created by an admin) are never touched. Every row is labelled Demo in the UI.
 */

const DAY = 24 * 60 * 60 * 1000;

/** Cover image: the demo photo, resized to 1600 px and written as JPEG (the content-media route serves jpg or png covers). */
async function coverJpeg(fileName: string): Promise<Buffer> {
  const processed = await processMedia(await readDemoPhoto(fileName));
  if (!processed.ok || processed.media.kind !== "IMAGE") throw new Error(`Demo cover failed processing: ${fileName}`);
  return sharp(processed.media.main.data).jpeg({ quality: 85 }).toBuffer();
}

export async function seedM6Content(
  prisma: PrismaClient,
  now = new Date(),
  storage?: StorageProvider,
): Promise<{ articles: number; references: number }> {
  assertDemoAllowed();
  const store = storage ?? getStorageProvider();

  const categories = await prisma.category.findMany({
    where: { slug: { in: M6_DEMO_REFERENCE_CATEGORY_SLUGS } },
    select: { slug: true },
  });
  const known = new Set(categories.map((c) => c.slug));
  const missing = M6_DEMO_REFERENCE_CATEGORY_SLUGS.filter((slug) => !known.has(slug));
  if (missing.length > 0) {
    throw new Error(`Catalogue categories are missing (${missing.join(", ")}). Run "npm run db:seed:demo" first.`);
  }

  // Remove previous demo rows only. Admin-created content is untouched. Their demo cover files go too.
  const oldCovers = await prisma.article.findMany({ where: { isDemo: true, coverKey: { not: null } }, select: { coverKey: true } });
  await prisma.article.deleteMany({ where: { isDemo: true } });
  await prisma.referenceEntry.deleteMany({ where: { isDemo: true } });
  for (const old of oldCovers) if (old.coverKey) await store.delete(old.coverKey);

  const takenArticleSlugs = new Set((await prisma.article.findMany({ select: { slug: true } })).map((r) => r.slug));
  for (const item of M6_DEMO_ARTICLES) {
    const slug = uniqueSlug(slugify(item.title, "demo-item"), takenArticleSlugs);
    takenArticleSlugs.add(slug);
    const scheduled = item.status === "SCHEDULED";
    const article = await prisma.article.create({
      data: {
        slug,
        type: item.type,
        title: item.title,
        summary: item.summary,
        body: item.body,
        status: item.status,
        tags: item.tags,
        category: item.category ?? null,
        sourceName: item.sourceName ?? null,
        sourceUrl: item.sourceUrl ?? null,
        metaDescription: item.metaDescription ?? null,
        readingMinutes: readingMinutes(item.body),
        scheduledFor: scheduled && item.scheduledInDays !== undefined ? new Date(now.getTime() + item.scheduledInDays * DAY) : null,
        publishedAt: !scheduled && item.publishedDaysAgo !== undefined ? new Date(now.getTime() - item.publishedDaysAgo * DAY) : null,
        isDemo: true,
      },
      select: { id: true },
    });

    const coverKey = buildCoverKey(article.id, "jpg", randomBytes(8).toString("hex"));
    await store.put(coverKey, await coverJpeg(item.coverFile));
    await prisma.article.update({ where: { id: article.id }, data: { coverKey, coverAlt: item.coverAlt } });
  }

  const takenReferenceSlugs = new Set((await prisma.referenceEntry.findMany({ select: { slug: true } })).map((r) => r.slug));
  for (const entry of M6_DEMO_REFERENCE) {
    const slug = uniqueSlug(slugify(entry.name, "gemstone"), takenReferenceSlugs);
    takenReferenceSlugs.add(slug);
    await prisma.referenceEntry.create({
      data: {
        slug,
        name: entry.name,
        categorySlug: entry.categorySlug,
        summary: entry.summary,
        hardness: entry.hardness,
        properties: entry.properties,
        origins: entry.origins,
        treatments: entry.treatments,
        qualityGuide: entry.qualityGuide,
        care: entry.care,
        priceFactors: entry.priceFactors,
        metaDescription: entry.metaDescription,
        status: "PUBLISHED",
        sortOrder: entry.sortOrder,
        publishedAt: new Date(now.getTime() - 45 * DAY),
        isDemo: true,
      },
    });
  }

  return { articles: M6_DEMO_ARTICLES.length, references: M6_DEMO_REFERENCE.length };
}

async function main(): Promise<void> {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
  try {
    const result = await seedM6Content(prisma);
    console.log(
      [
        "M6 content demo seed complete.",
        `  Articles, guides, research and news: ${result.articles} demo rows (one scheduled, five news items).`,
        `  Reference library: ${result.references} demo pages, one per catalogue category.`,
        "  Every row is isDemo and labelled Demo – needs expert review.",
      ].join("\n"),
    );
  } finally {
    await prisma.$disconnect();
  }
}

// Run only when executed directly (npm run db:seed:m6), never when imported by tests.
if (process.argv[1]?.replace(/\\/g, "/").endsWith("prisma/seed-m6-content.ts")) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
