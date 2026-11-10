import "dotenv/config";
import { randomBytes } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/app/generated/prisma/client";
import { hashPassword } from "@/lib/auth/password";
import { assertDemoAllowed } from "@/lib/demo/guard";
import { buildDemoReferenceRows, DEMO_MULTIPLIERS } from "@/lib/valuation/defaults";
import { newValuationReference } from "@/lib/valuation/reference";
import { MULTIPLIER_KIND_LABELS, MULTIPLIER_KINDS } from "@/lib/valuation/admin-values";

/**
 * M4 demo data for valuations: the demo reference price table and multipliers, one demo valuer, and five demo
 * valuations in different states (auto valued, in expert review, needs info, completed, rejected).
 *
 * Run with: npm run db:seed:m4   (needs ALLOW_DEMO_SEED=true, and `npm run db:seed:demo` to have run first, because
 * the requester is the demo buyer that seed creates). Refuses to run in production.
 *
 * Idempotent: reference prices and multipliers are created only where missing (admin edits are never overwritten).
 * Demo valuations are deleted and recreated. The demo valuer is updated in place.
 *
 * Everything here is demo: rows carry isDemo true, the valuer uses the example.test domain (reserved for tests),
 * and the valuer's password is a documented DEV-ONLY value, overridable with M4_DEMO_VALUATOR_PASSWORD.
 * Never use these credentials anywhere else.
 */

export const M4_DEMO_VALUER_EMAIL = "demo.valuer@example.test";
export const M4_DEMO_VALUER_DEFAULT_PASSWORD = "demo-valuer-dev-only-change-me";
const DEMO_BUYER_EMAIL = "demo-buyer-1@example.com";

const DAY = 24 * 60 * 60 * 1000;

function rupees(major: number): bigint {
  // Whole rupees only in this seed, so the multiplication is exact.
  return BigInt(major) * BigInt(100);
}

export async function seedM4Demo(prisma: PrismaClient, now = new Date()): Promise<void> {
  assertDemoAllowed();

  // 1. The requester: the demo buyer from the demo seed.
  const buyer = await prisma.user.findUnique({ where: { email: DEMO_BUYER_EMAIL }, select: { id: true } });
  if (!buyer) {
    throw new Error('The demo buyer is missing. Run "npm run db:seed:demo" first, then "npm run db:seed:m4".');
  }

  // 2. Reference prices and multipliers. Created only where missing, so admin edits survive a re-run.
  const priceRows = buildDemoReferenceRows().map((row) => ({
    gemstoneType: row.gemstoneType,
    qualityGrade: row.qualityGrade,
    band: row.band,
    currency: row.currency,
    pricePerCaratMinor: row.pricePerCaratMinor,
    isDemo: true,
  }));
  const priceResult = await prisma.referencePrice.createMany({ data: priceRows, skipDuplicates: true });

  const multiplierRows: Array<{ kind: string; key: string; label: string; bps: number; isDemo: boolean }> = [];
  for (const kind of MULTIPLIER_KINDS) {
    const table = DEMO_MULTIPLIERS[kind];
    for (const [key, bps] of Object.entries(table)) {
      multiplierRows.push({
        kind,
        key,
        label: `${key.charAt(0).toUpperCase()}${key.slice(1)} (${MULTIPLIER_KIND_LABELS[kind]})`,
        bps,
        isDemo: true,
      });
    }
  }
  const multiplierResult = await prisma.valuationMultiplier.createMany({ data: multiplierRows, skipDuplicates: true });

  // 3. The demo valuer. Its password is the documented dev value unless overridden in the environment.
  const password = process.env.M4_DEMO_VALUATOR_PASSWORD?.trim() || M4_DEMO_VALUER_DEFAULT_PASSWORD;
  const passwordHash = await hashPassword(password);
  const valuer = await prisma.user.upsert({
    where: { email: M4_DEMO_VALUER_EMAIL },
    create: {
      email: M4_DEMO_VALUER_EMAIL,
      name: "Demo valuer",
      role: "VALUATOR",
      status: "ACTIVE",
      emailVerifiedAt: now,
      passwordHash,
    },
    update: { role: "VALUATOR", status: "ACTIVE", emailVerifiedAt: now, passwordHash },
    select: { id: true },
  });

  // 4. Demo valuations. Earlier demo rows go first; notes, media and thread entries cascade.
  await prisma.valuation.deleteMany({ where: { isDemo: true } });

  const categories = await prisma.category.findMany({ select: { id: true, name: true } });
  const categoryId = (name: string) => categories.find((c) => c.name === name)?.id ?? null;
  const reference = () => newValuationReference((size) => new Uint8Array(randomBytes(size)), now.getFullYear());

  const baseAuto = (estimate: number, low: number, high: number, confidence: "LOW" | "MEDIUM" | "HIGH") => ({
    autoEstimateMinor: rupees(estimate),
    autoLowMinor: rupees(low),
    autoHighMinor: rupees(high),
    autoConfidence: confidence,
  });

  // AUTO_VALUED: the engine answered alone.
  const autoValued = await prisma.valuation.create({
    data: {
      reference: reference(),
      requesterId: buyer.id,
      source: "STANDALONE",
      status: "AUTO_VALUED",
      isDemo: true,
      gemstoneType: "Ruby",
      categoryId: categoryId("Ruby"),
      caratMilli: 1200,
      colour: "Pigeon blood red",
      clarity: "Eye clean",
      qualityGrade: "FINE",
      origin: "Burma",
      treatment: "None",
      currency: "INR",
      ...baseAuto(1840000, 1600000, 2080000, "MEDIUM"),
      autoFactors: ["Demo reference price: Ruby, fine grade, 1 to 2 ct", "Origin Burma: 130% of base", "Treatment: none"],
      expertReasons: [],
      valuedBy: "AUTO",
      submittedAt: new Date(now.getTime() - 3 * DAY),
    },
  });

  // IN_EXPERT_REVIEW, assigned to the demo valuer.
  const inReview = await prisma.valuation.create({
    data: {
      reference: reference(),
      requesterId: buyer.id,
      source: "LISTING",
      gemstoneId: null,
      status: "IN_EXPERT_REVIEW",
      isDemo: true,
      gemstoneType: "Sapphire",
      categoryId: categoryId("Sapphire"),
      caratMilli: 3400,
      colour: "Cornflower blue",
      clarity: "Slightly included",
      qualityGrade: "STANDARD",
      origin: "Ceylon",
      treatment: "Heat",
      labId: null,
      currency: "INR",
      requestExpert: true,
      ...baseAuto(950000, 620000, 1280000, "LOW"),
      autoFactors: ["Demo reference price: Sapphire, standard grade, 2 to 5 ct", "Treatment heat: 85% of base"],
      expertReasons: ["ABOVE_THRESHOLD", "LOW_CONFIDENCE"],
      assignedValuatorId: valuer.id,
      submittedAt: new Date(now.getTime() - 1 * DAY),
    },
  });

  // NEEDS_INFO: the valuer has asked a question.
  const needsInfo = await prisma.valuation.create({
    data: {
      reference: reference(),
      requesterId: buyer.id,
      source: "STANDALONE",
      status: "NEEDS_INFO",
      isDemo: true,
      gemstoneType: "Emerald",
      categoryId: categoryId("Emerald"),
      caratMilli: 800,
      colour: "Vivid green",
      clarity: "Moderately included",
      qualityGrade: "FINE",
      origin: "Colombia",
      treatment: "Oil",
      currency: "INR",
      requestExpert: false,
      ...baseAuto(410000, 300000, 520000, "LOW"),
      autoFactors: ["Demo reference price: Emerald, fine grade, under 1 ct", "Treatment oil: 80% of base"],
      expertReasons: ["INCOMPLETE"],
      assignedValuatorId: valuer.id,
      submittedAt: new Date(now.getTime() - 2 * DAY),
    },
  });
  await prisma.valuationNote.create({
    data: {
      valuationId: needsInfo.id,
      authorId: valuer.id,
      kind: "INFO_REQUEST",
      body: "Demo question: does the oil treatment appear on the lab report? The answer changes the treatment multiplier.",
    },
  });

  // COMPLETED with an expert sign-off.
  const completed = await prisma.valuation.create({
    data: {
      reference: reference(),
      requesterId: buyer.id,
      source: "STANDALONE",
      status: "COMPLETED",
      isDemo: true,
      gemstoneType: "Diamond",
      categoryId: categoryId("Diamond"),
      caratMilli: 2100,
      colour: "D",
      clarity: "VS1",
      qualityGrade: "PREMIUM",
      origin: "India",
      treatment: "None",
      currency: "INR",
      requestExpert: true,
      ...baseAuto(4200000, 3600000, 4800000, "MEDIUM"),
      autoFactors: ["Demo reference price: Diamond, premium grade, 2 to 5 ct"],
      expertReasons: ["REQUESTED"],
      valuedBy: "EXPERT",
      finalEstimateMinor: rupees(4400000),
      finalLowMinor: rupees(4000000),
      finalHighMinor: rupees(4800000),
      finalConfidence: "HIGH",
      assignedValuatorId: valuer.id,
      submittedAt: new Date(now.getTime() - 5 * DAY),
      completedAt: new Date(now.getTime() - 2 * DAY),
    },
  });
  await prisma.valuationNote.create({
    data: {
      valuationId: completed.id,
      authorId: valuer.id,
      kind: "SIGNOFF",
      body: "Demo sign-off: colour and clarity match the stated grade. Demo data, not a real valuation.",
    },
  });

  // REJECTED with a reason.
  await prisma.valuation.create({
    data: {
      reference: reference(),
      requesterId: buyer.id,
      source: "STANDALONE",
      status: "REJECTED",
      isDemo: true,
      gemstoneType: "Tourmaline",
      categoryId: categoryId("Tourmaline"),
      caratMilli: 500,
      colour: "Green",
      qualityGrade: "COMMERCIAL",
      currency: "INR",
      requestExpert: true,
      expertReasons: ["REQUESTED"],
      rejectionReason: "Demo: the photos do not show the stone clearly. Please submit a new request with clearer photos.",
      assignedValuatorId: valuer.id,
      submittedAt: new Date(now.getTime() - 6 * DAY),
    },
  });

  console.log(
    [
      "M4 demo seed complete.",
      `  Reference prices: ${priceResult.count} created (existing rows left alone).`,
      `  Multipliers: ${multiplierResult.count} created (existing rows left alone).`,
      `  Demo valuer: ${M4_DEMO_VALUER_EMAIL} (password from M4_DEMO_VALUATOR_PASSWORD, or the documented dev default).`,
      `  Demo valuations: 5 (auto valued ${autoValued.reference}, in review ${inReview.reference}, needs info ${needsInfo.reference}, completed ${completed.reference}, rejected).`,
    ].join("\n"),
  );
}

async function main(): Promise<void> {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
  try {
    await seedM4Demo(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

// Run only when executed directly (npm run db:seed:m4), never when imported by tests.
if (process.argv[1]?.replace(/\\/g, "/").endsWith("prisma/seed-m4-demo.ts")) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
