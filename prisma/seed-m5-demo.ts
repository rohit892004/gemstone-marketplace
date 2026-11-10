import "dotenv/config";
import { randomBytes } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/app/generated/prisma/client";
import { assertDemoAllowed } from "@/lib/demo/guard";
import { ruleFor, type Tier } from "@/lib/membership/tiers";
import { DEFAULT_TIER_RULES } from "@/lib/membership/defaults";

/**
 * M5 demo data: 90 days of seller and platform analytics rollups, followers, referrals, and demo memberships on each
 * tier. Run with: npm run db:seed:m5   (needs ALLOW_DEMO_SEED=true, and `npm run db:seed:demo` to have run first, for
 * the demo sellers). Refuses to run in production.
 *
 * Idempotent: first deletes the previous M5 demo rows (memberships, follows, referrals, and rollups with isDemo true,
 * plus the demo users this seed created). Then writes everything again.
 *
 * Rules: SellerMembership rows are written directly with isDemo true. evaluateMemberships is NOT run here (it belongs
 * to the rollup job). The Premium demo seller meets the Premium rule (referrals, followers and response rate). The
 * Elite demo seller holds Elite by a manual override, because the Elite rule needs a rating from non-demo reviews,
 * which demo data does not have.
 *
 * Platform rollups use the same keys as the rollup job. A day that already has a real platform row is left alone.
 */

export const M5_DEMO_EMAIL_DOMAIN = "m5-demo.gemstone.local";
const DAY_MS = 24 * 60 * 60 * 1000;
const HISTORY_DAYS = 90;
const FOLLOWER_POOL = 130;
const PREMIUM_FOLLOWERS = 60;
const ELITE_FOLLOWERS = 120;
const PREMIUM_REFERRALS = 6;
const ELITE_REFERRALS = 22;
const FLAGGED_REFERRALS = 1;
const PENDING_REFERRALS = 2;
const ROLLUP_CHUNK = 500;

const SELLER_KINDS = [
  "PROFILE_VIEW",
  "LISTING_VIEW",
  "LISTING_IMPRESSION",
  "WISHLIST_ADD",
  "ENQUIRY_STARTED",
  "QUOTATION_SENT",
  "VALUATION_REQUESTED",
  "FOLLOW",
] as const;

const PLATFORM_KINDS = [
  "PLATFORM_SIGNUP_BUYER",
  "PLATFORM_SIGNUP_SELLER",
  "PLATFORM_SELLER_APPROVED",
  "PLATFORM_LISTING_PUBLISHED",
  "PLATFORM_ENQUIRY",
  "PLATFORM_CONVERSATION",
  "PLATFORM_QUOTATION",
  "PLATFORM_VALUATION",
  "PLATFORM_ACTIVE_USER",
] as const;

const DEMO_TERMS = ["sapphire", "ruby", "emerald", "spinel", "tourmaline", "garnet", "aquamarine", "topaz", "padparadscha", "opal"];

/** A small seeded generator, so the same run always writes the same numbers. */
function prng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function dayKeyOf(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** The last HISTORY_DAYS UTC days, oldest first, ending today. */
export function historyDays(now: Date): string[] {
  const days: string[] = [];
  const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  for (let i = HISTORY_DAYS - 1; i >= 0; i--) days.push(dayKeyOf(new Date(start - i * DAY_MS)));
  return days;
}

/** Rollup key format used by the rollup job: day|kind|sellerId|gemstoneId, empty strings for nulls. */
export function rollupKey(day: string, kind: string, sellerId: string | null, gemstoneId: string | null): string {
  return `${day}|${kind}|${sellerId ?? ""}|${gemstoneId ?? ""}`;
}

interface RollupRow {
  key: string;
  day: Date;
  kind: string;
  sellerId: string | null;
  gemstoneId: string | null;
  count: number;
  uniqueVisitors: number;
  isDemo: boolean;
}

/** Seller series: a base level by tier, a gentle upward trend, a weekly rhythm and some noise. */
export function sellerRollups(sellerId: string, tier: Tier, days: string[], seed: number, listingIds: string[] = []): RollupRow[] {
  const rand = prng(seed);
  const base: Record<Tier, number> = { FREE: 6, PREMIUM: 22, ELITE: 48 };
  const rows: RollupRow[] = [];
  days.forEach((day, index) => {
    const trend = 0.7 + (0.6 * index) / days.length;
    const weekday = new Date(day + "T00:00:00.000Z").getUTCDay();
    const rhythm = weekday === 0 || weekday === 6 ? 0.7 : 1.1;
    for (const kind of SELLER_KINDS) {
      const kindWeight: Record<(typeof SELLER_KINDS)[number], number> = {
        PROFILE_VIEW: 4,
        LISTING_VIEW: 6,
        LISTING_IMPRESSION: 30,
        WISHLIST_ADD: 0.8,
        ENQUIRY_STARTED: 0.5,
        QUOTATION_SENT: 0.2,
        VALUATION_REQUESTED: 0.15,
        FOLLOW: 0.25,
      };
      const noise = 0.6 + rand() * 0.8;
      const count = Math.max(0, Math.round(base[tier] * kindWeight[kind] * trend * rhythm * noise));
      // Listing views and impressions are kept per listing, as the rollup job writes them from real events. The
      // day's total is split across the seller's listings, so seller totals (a sum over listings) stay the same.
      const perListing = (kind === "LISTING_VIEW" || kind === "LISTING_IMPRESSION") && listingIds.length > 0;
      if (perListing) {
        const weights = listingIds.map(() => 0.5 + rand());
        const total = weights.reduce((a, b) => a + b, 0);
        let assigned = 0;
        listingIds.forEach((gemstoneId, j) => {
          const share = j === listingIds.length - 1 ? count - assigned : Math.round((count * weights[j]) / total);
          assigned += share;
          if (share <= 0) return;
          rows.push({
            key: rollupKey(day, kind, sellerId, gemstoneId),
            day: new Date(day + "T00:00:00.000Z"),
            kind,
            sellerId,
            gemstoneId,
            count: share,
            uniqueVisitors: Math.round(share * (0.55 + rand() * 0.2)),
            isDemo: true,
          });
        });
        continue;
      }
      rows.push({
        key: rollupKey(day, kind, sellerId, null),
        day: new Date(day + "T00:00:00.000Z"),
        kind,
        sellerId,
        gemstoneId: null,
        count,
        uniqueVisitors: Math.round(count * (0.55 + rand() * 0.2)),
        isDemo: true,
      });
    }
  });
  return rows;
}

/** Platform series: one row per kind per day, plus the top 10 terms and categories per day. */
export function platformRollups(days: string[], categoryIds: string[], seed: number): RollupRow[] {
  const rand = prng(seed);
  const rows: RollupRow[] = [];
  days.forEach((day, index) => {
    const trend = 0.8 + (0.4 * index) / days.length;
    const weekday = new Date(day + "T00:00:00.000Z").getUTCDay();
    const rhythm = weekday === 0 || weekday === 6 ? 0.6 : 1.1;
    const level: Record<(typeof PLATFORM_KINDS)[number], number> = {
      PLATFORM_SIGNUP_BUYER: 9,
      PLATFORM_SIGNUP_SELLER: 2,
      PLATFORM_SELLER_APPROVED: 1.5,
      PLATFORM_LISTING_PUBLISHED: 12,
      PLATFORM_ENQUIRY: 14,
      PLATFORM_CONVERSATION: 18,
      PLATFORM_QUOTATION: 3,
      PLATFORM_VALUATION: 2,
      PLATFORM_ACTIVE_USER: 150,
    };
    for (const kind of PLATFORM_KINDS) {
      const count = Math.max(0, Math.round(level[kind] * trend * rhythm * (0.6 + rand() * 0.8)));
      rows.push({ key: rollupKey(day, kind, null, null), day: new Date(day + "T00:00:00.000Z"), kind, sellerId: null, gemstoneId: null, count, uniqueVisitors: 0, isDemo: true });
    }
    DEMO_TERMS.forEach((term, rank) => {
      const count = Math.max(1, Math.round((60 - rank * 5) * trend * (0.7 + rand() * 0.6)));
      const kind = `PLATFORM_TOP_TERM:${term}`;
      rows.push({ key: rollupKey(day, kind, null, null), day: new Date(day + "T00:00:00.000Z"), kind, sellerId: null, gemstoneId: null, count, uniqueVisitors: 0, isDemo: true });
    });
    categoryIds.slice(0, 10).forEach((id, rank) => {
      const count = Math.max(1, Math.round((80 - rank * 6) * trend * (0.7 + rand() * 0.6)));
      const kind = `PLATFORM_TOP_CATEGORY:${id}`;
      rows.push({ key: rollupKey(day, kind, null, null), day: new Date(day + "T00:00:00.000Z"), kind, sellerId: null, gemstoneId: null, count, uniqueVisitors: 0, isDemo: true });
    });
  });
  return rows;
}

function unusablePasswordHash(): string {
  // Not a valid scrypt string, so no password can ever match. Demo followers and referrals never sign in.
  return "demo-no-login-" + randomBytes(24).toString("hex");
}

export async function seedM5Demo(prisma: PrismaClient, now: Date = new Date()): Promise<void> {
  assertDemoAllowed();

  const sellers = await prisma.sellerProfile.findMany({
    where: { isDemo: true, approvalStatus: "APPROVED" },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true, businessName: true },
  });
  if (sellers.length < 4) {
    throw new Error('Not enough approved demo sellers. Run "npm run db:seed:demo" first, then "npm run db:seed:m5".');
  }
  const [premiumSeller, eliteSeller, ...others] = sellers;
  const freeSellers = others.slice(0, 3);
  const tierFor = new Map<string, Tier>([
    [premiumSeller.id, "PREMIUM"],
    [eliteSeller.id, "ELITE"],
    ...freeSellers.map((s) => [s.id, "FREE"] as [string, Tier]),
  ]);
  const followerTargets = new Map<string, number>([
    [premiumSeller.id, PREMIUM_FOLLOWERS],
    [eliteSeller.id, ELITE_FOLLOWERS],
    [freeSellers[0].id, 9],
    [freeSellers[1].id, 4],
    [freeSellers[2].id, 0],
  ]);

  // 1. Clear the previous M5 demo rows.
  await prisma.follow.deleteMany({ where: { isDemo: true } });
  await prisma.referral.deleteMany({ where: { isDemo: true } });
  await prisma.sellerMembership.deleteMany({ where: { isDemo: true } });
  await prisma.analyticsRollup.deleteMany({ where: { isDemo: true } });
  await prisma.analyticsEvent.deleteMany({ where: { isDemo: true } });
  await prisma.user.deleteMany({ where: { email: { endsWith: `@${M5_DEMO_EMAIL_DOMAIN}` } } });

  // 2. Demo users: followers (buyers) and referred sign-ups (sellers without a profile yet).
  const followers: { id: string }[] = [];
  for (let i = 1; i <= FOLLOWER_POOL; i++) {
    followers.push(
      await prisma.user.create({
        data: {
          email: `m5-follower-${i}@${M5_DEMO_EMAIL_DOMAIN}`,
          name: `Demo follower ${i}`,
          passwordHash: unusablePasswordHash(),
          role: "BUYER",
          status: "ACTIVE",
          emailVerifiedAt: now,
        },
        select: { id: true },
      }),
    );
  }
  const referredCount = PREMIUM_REFERRALS + ELITE_REFERRALS + FLAGGED_REFERRALS + PENDING_REFERRALS;
  const referred: { id: string }[] = [];
  for (let i = 1; i <= referredCount; i++) {
    referred.push(
      await prisma.user.create({
        data: {
          email: `m5-referred-${i}@${M5_DEMO_EMAIL_DOMAIN}`,
          name: `Demo referred sign-up ${i}`,
          passwordHash: unusablePasswordHash(),
          role: "SELLER",
          status: "ACTIVE",
          emailVerifiedAt: now,
        },
        select: { id: true },
      }),
    );
  }

  // 3. Follows. The first N followers follow each seller, so the counts are exact.
  const followRows: { followerId: string; sellerId: string; createdAt: Date; isDemo: boolean }[] = [];
  for (const [sellerId, target] of followerTargets) {
    followers.slice(0, target).forEach((f, i) => {
      followRows.push({ followerId: f.id, sellerId, createdAt: new Date(now.getTime() - (i + 1) * DAY_MS * 0.6), isDemo: true });
    });
  }
  await prisma.follow.createMany({ data: followRows });

  // 4. Referrals. The Premium and Elite sellers get QUALIFIED referrals; one flagged and two pending sit in the queue.
  const referralRows: {
    referrerSellerId: string;
    referredUserId: string;
    status: "QUALIFIED" | "PENDING";
    flagged: boolean;
    flagReason: string | null;
    qualifiedAt: Date | null;
    createdAt: Date;
    isDemo: boolean;
  }[] = [];
  let next = 0;
  const addReferral = (referrerSellerId: string, status: "QUALIFIED" | "PENDING", flagged = false) => {
    const user = referred[next++];
    const ageDays = 5 + next * 2;
    referralRows.push({
      referrerSellerId,
      referredUserId: user.id,
      status,
      flagged,
      flagReason: flagged ? "Same IP address as another referred sign-up" : null,
      qualifiedAt: status === "QUALIFIED" ? new Date(now.getTime() - (ageDays - 3) * DAY_MS) : null,
      createdAt: new Date(now.getTime() - ageDays * DAY_MS),
      isDemo: true,
    });
  };
  for (let i = 0; i < PREMIUM_REFERRALS; i++) addReferral(premiumSeller.id, "QUALIFIED");
  for (let i = 0; i < ELITE_REFERRALS; i++) addReferral(eliteSeller.id, "QUALIFIED");
  addReferral(freeSellers[0].id, "PENDING", true);
  for (let i = 0; i < PENDING_REFERRALS; i++) addReferral(premiumSeller.id, "PENDING");
  await prisma.referral.createMany({ data: referralRows });

  // 5. Memberships, written directly. Counts match the rows above.
  const referralCount = new Map<string, number>([[premiumSeller.id, PREMIUM_REFERRALS], [eliteSeller.id, ELITE_REFERRALS]]);
  const responseRateFor: Record<Tier, number> = { FREE: 45, PREMIUM: 80, ELITE: 92 };
  const rules = DEFAULT_TIER_RULES;
  for (const seller of sellers) {
    const tier = tierFor.get(seller.id) ?? "FREE";
    const manual = tier === "ELITE";
    await prisma.sellerMembership.create({
      data: {
        sellerId: seller.id,
        tier,
        tierSince: new Date(now.getTime() - 40 * DAY_MS),
        manualOverride: manual,
        overrideReason: manual ? "Demo Elite account for the walkthrough" : null,
        qualifiedReferrals: referralCount.get(seller.id) ?? 0,
        followerCount: followerTargets.get(seller.id) ?? 0,
        responseRate: responseRateFor[tier],
        averageRating: null,
        evaluatedAt: now,
        isDemo: true,
      },
    });
  }

  // 6. Analytics rollups for the demo sellers (90 days), then platform rows.
  const days = historyDays(now);
  const categories = await prisma.category.findMany({ orderBy: { slug: "asc" }, take: 10, select: { id: true } });
  const listings = await prisma.gemstone.findMany({
    where: { sellerId: { in: sellers.map((s) => s.id) }, status: "PUBLISHED" },
    select: { id: true, sellerId: true },
    orderBy: { id: "asc" },
  });
  const sellerRows = sellers.flatMap((s, i) =>
    sellerRollups(
      s.id,
      tierFor.get(s.id) ?? "FREE",
      days,
      1000 + i,
      listings.filter((l) => l.sellerId === s.id).map((l) => l.id),
    ),
  );
  const platform = platformRollups(days, categories.map((c) => c.id), 4242);

  // Platform keys are shared with the real rollup job. Skip any day already written by it (never overwrite real data).
  const existingPlatform = await prisma.analyticsRollup.findMany({
    where: { sellerId: null, isDemo: false, kind: { startsWith: "PLATFORM_" } },
    select: { key: true },
  });
  const taken = new Set(existingPlatform.map((r) => r.key));
  const platformFresh = platform.filter((r) => !taken.has(r.key));

  const allRows = [...sellerRows, ...platformFresh];
  for (let i = 0; i < allRows.length; i += ROLLUP_CHUNK) {
    await prisma.analyticsRollup.createMany({ data: allRows.slice(i, i + ROLLUP_CHUNK), skipDuplicates: true });
  }

  console.log(
    [
      "M5 demo data written.",
      `  Sellers: ${sellers.length} demo sellers (1 Premium, 1 Elite, ${sellers.length - 2} Free). Premium: ${premiumSeller.businessName}. Elite (override): ${eliteSeller.businessName}.`,
      `  Followers: ${followRows.length} follows from ${FOLLOWER_POOL} demo buyers.`,
      `  Referrals: ${PREMIUM_REFERRALS + ELITE_REFERRALS} qualified, ${PENDING_REFERRALS} pending, ${FLAGGED_REFERRALS} flagged.`,
      `  Rollups: ${sellerRows.length} seller rows and ${platformFresh.length} platform rows (${platform.length - platformFresh.length} skipped, real data already present).`,
      `  Rule check, Premium: ${ruleFor(rules, "PREMIUM").unlockFollowers} followers and ${ruleFor(rules, "PREMIUM").unlockReferrals} referrals, response 80%.`,
    ].join("\n"),
  );
}

async function main(): Promise<void> {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
  try {
    await seedM5Demo(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

// Run only when executed directly (npm run db:seed:m5), never when imported by tests.
if (process.argv[1]?.replace(/\\/g, "/").endsWith("prisma/seed-m5-demo.ts")) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
