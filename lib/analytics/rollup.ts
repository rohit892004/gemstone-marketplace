import { recordAudit } from "@/lib/audit/audit";
import { AuditAction } from "@/lib/audit/actions";
import { prisma } from "@/lib/db/client";
import { evaluateMemberships, qualifyReferrals } from "@/lib/membership/service";
import { dayKey, looksLikeContactDetail, retentionCutoff } from "./events";

/**
 * The daily rollup job (npm run analytics:rollup, once a day). It:
 *  1. Aggregates each finished UTC day since the last run into AnalyticsRollup (seller, listing and platform rows).
 *  2. Deletes raw events older than 90 days. Rollups are kept.
 *  3. Runs the membership tier pass and qualifies pending referrals.
 * Re-running is safe: a day's rollup rows are upserted by key, and the last processed day is stored.
 */

export const ROLLUP_THROUGH_KEY = "analytics.rollupThrough";
const DAY_MS = 24 * 60 * 60 * 1000;
const TOP_LIMIT = 50;

export interface RollupSummary {
  daysProcessed: number;
  rowsWritten: number;
  eventsDeleted: number;
  membershipsEvaluated: number;
  tierChanges: number;
  referralsQualified: number;
}

function utcDay(date: Date): Date {
  return new Date(dayKey(date) + "T00:00:00.000Z");
}

async function lastProcessedDay(): Promise<Date | null> {
  const row = await prisma.appSetting.findUnique({ where: { key: ROLLUP_THROUGH_KEY } });
  if (!row || typeof row.value !== "string") return null;
  const parsed = new Date(row.value + "T00:00:00.000Z");
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

async function saveLastProcessedDay(day: Date): Promise<void> {
  const value = dayKey(day);
  await prisma.appSetting.upsert({
    where: { key: ROLLUP_THROUGH_KEY },
    create: { key: ROLLUP_THROUGH_KEY, value },
    update: { value },
  });
}

function rowKey(day: Date, kind: string, sellerId: string | null, gemstoneId: string | null): string {
  return `${dayKey(day)}|${kind}|${sellerId ?? ""}|${gemstoneId ?? ""}`;
}

/**
 * Writes one rollup row. A demo row seeded by hand keeps its demo flag on a re-run: platform and term rows never clear
 * it, because their demo status is set when the row is seeded, not derived from events.
 */
async function upsertRollup(input: {
  day: Date;
  kind: string;
  sellerId: string | null;
  gemstoneId: string | null;
  count: number;
  uniqueVisitors: number;
  isDemo: boolean;
  keepDemoFlag?: boolean;
}): Promise<void> {
  const key = rowKey(input.day, input.kind, input.sellerId, input.gemstoneId);
  const data = {
    day: input.day,
    kind: input.kind,
    sellerId: input.sellerId,
    gemstoneId: input.gemstoneId,
    count: input.count,
    uniqueVisitors: input.uniqueVisitors,
  };
  await prisma.analyticsRollup.upsert({
    where: { key },
    create: { key, ...data, isDemo: input.isDemo },
    update: input.keepDemoFlag ? data : { ...data, isDemo: input.isDemo },
  });
}

/** Aggregates one UTC day. Returns how many rollup rows were written. */
export async function rollupDay(day: Date): Promise<number> {
  const next = new Date(day.getTime() + DAY_MS);
  let rows = 0;

  // Seller and listing events.
  const grouped = await prisma.$queryRaw<
    Array<{ kind: string; sellerId: string | null; gemstoneId: string | null; c: number; u: number; demo: boolean }>
  >`SELECT kind::text AS kind, "sellerId", "gemstoneId", count(*)::int AS c,
           count(DISTINCT "visitorHash")::int AS u, bool_or("isDemo") AS demo
    FROM "AnalyticsEvent" WHERE day = ${day}
    GROUP BY kind, "sellerId", "gemstoneId"`;
  for (const row of grouped) {
    await upsertRollup({ day, kind: row.kind, sellerId: row.sellerId, gemstoneId: row.gemstoneId, count: row.c, uniqueVisitors: row.u, isDemo: row.demo });
    rows += 1;
  }

  // Top search terms and top categories for the day.
  // A term is kept only when at least two different visitors searched it that day, so one person's search (which may
  // be typed personal information) never appears as a platform trend. Contact-like terms are dropped.
  const terms = await prisma.$queryRaw<Array<{ term: string; c: number }>>`
    SELECT term, count(*)::int AS c FROM "AnalyticsEvent"
    WHERE day = ${day} AND kind = 'SEARCH' AND term IS NOT NULL
    GROUP BY term HAVING count(DISTINCT "visitorHash") >= 2
    ORDER BY c DESC LIMIT ${TOP_LIMIT}`;
  for (const row of terms.filter((t) => !looksLikeContactDetail(t.term))) {
    await upsertRollup({ day, kind: "PLATFORM_TOP_TERM:" + row.term, sellerId: null, gemstoneId: null, count: row.c, uniqueVisitors: 0, isDemo: false, keepDemoFlag: true });
    rows += 1;
  }
  const categories = await prisma.$queryRaw<Array<{ id: string; c: number }>>`
    SELECT "categoryId" AS id, count(*)::int AS c FROM "AnalyticsEvent"
    WHERE day = ${day} AND kind = 'LISTING_VIEW' AND "categoryId" IS NOT NULL
    GROUP BY "categoryId" ORDER BY c DESC LIMIT ${TOP_LIMIT}`;
  for (const row of categories) {
    await upsertRollup({ day, kind: "PLATFORM_TOP_CATEGORY:" + row.id, sellerId: null, gemstoneId: null, count: row.c, uniqueVisitors: 0, isDemo: false, keepDemoFlag: true });
    rows += 1;
  }

  // Platform activity, from the business tables. Counted per day, so the dashboard never reads raw events for it.
  const inDay = (field: string) => ({ [field]: { gte: day, lt: next } });
  const platform: Array<[string, number]> = [
    ["PLATFORM_SIGNUP_BUYER", await prisma.user.count({ where: { role: "BUYER", ...inDay("createdAt") } })],
    ["PLATFORM_SIGNUP_SELLER", await prisma.user.count({ where: { role: "SELLER", ...inDay("createdAt") } })],
    ["PLATFORM_SELLER_APPROVED", await prisma.sellerProfile.count({ where: inDay("approvedAt") })],
    ["PLATFORM_LISTING_PUBLISHED", await prisma.gemstone.count({ where: inDay("publishedAt") })],
    ["PLATFORM_ENQUIRY", await prisma.conversation.count({ where: { kind: "ENQUIRY", ...inDay("createdAt") } })],
    ["PLATFORM_CONVERSATION", await prisma.conversation.count({ where: inDay("createdAt") })],
    ["PLATFORM_QUOTATION", await prisma.quotation.count({ where: inDay("createdAt") })],
    ["PLATFORM_VALUATION", await prisma.valuation.count({ where: inDay("createdAt") })],
    ["PLATFORM_ACTIVE_USER", await prisma.user.count({ where: inDay("lastLoginAt") })],
  ];
  for (const [kind, count] of platform) {
    await upsertRollup({ day, kind, sellerId: null, gemstoneId: null, count, uniqueVisitors: 0, isDemo: false, keepDemoFlag: true });
    rows += 1;
  }
  return rows;
}

/**
 * The job. `now` is injectable for tests. Processes every finished day since the last run (at least yesterday),
 * prunes raw events past retention, then runs the tier and referral passes.
 */
export async function runAnalyticsRollup(now: Date = new Date(), actorId: string | null = null): Promise<RollupSummary> {
  const today = utcDay(now);
  const yesterday = new Date(today.getTime() - DAY_MS);
  const through = await lastProcessedDay();
  const start = through ? new Date(through.getTime() + DAY_MS) : yesterday;

  let daysProcessed = 0;
  let rowsWritten = 0;
  for (let day = start; day.getTime() <= yesterday.getTime(); day = new Date(day.getTime() + DAY_MS)) {
    rowsWritten += await rollupDay(day);
    daysProcessed += 1;
    await saveLastProcessedDay(day);
  }

  const pruned = await prisma.analyticsEvent.deleteMany({ where: { occurredAt: { lt: retentionCutoff(now) } } });
  const memberships = await evaluateMemberships(now);
  const referralsQualified = await qualifyReferrals(now);

  const summary: RollupSummary = {
    daysProcessed,
    rowsWritten,
    eventsDeleted: pruned.count,
    membershipsEvaluated: memberships.evaluated,
    tierChanges: memberships.changed,
    referralsQualified,
  };
  await recordAudit({ action: AuditAction.ANALYTICS_ROLLUP_RUN, actorId, entityType: "AnalyticsRollup", entityId: dayKey(now), meta: { ...summary } as Record<string, number> });
  return summary;
}
