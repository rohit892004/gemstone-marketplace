import { prisma } from "@/lib/db/client";
import { ROLLUP_THROUGH_KEY } from "./rollup";
import { rollupRows, type RollupRow } from "./seller-summary";
import { addDays } from "./seller-trends";

/**
 * Seller analytics queries. Every query takes the seller's own SellerProfile id, so a seller can never read another
 * seller's figures. Only finished days are read: the caller passes the last figure day.
 */

function utcDay(day: string): Date {
  return new Date(day + "T00:00:00.000Z");
}

/** The last day the rollup job has fully processed (YYYY-MM-DD), or null when it has never run. */
export async function rolledThroughDay(): Promise<string | null> {
  const row = await prisma.appSetting.findUnique({ where: { key: ROLLUP_THROUGH_KEY } });
  return row && typeof row.value === "string" ? row.value : null;
}

/** The seller's rollup rows for an inclusive range of days. */
export async function sellerRollupRows(sellerProfileId: string, fromDay: string, lastDay: string): Promise<RollupRow[]> {
  const rows = await prisma.analyticsRollup.findMany({
    where: { sellerId: sellerProfileId, day: { gte: utcDay(fromDay), lte: utcDay(lastDay) } },
    select: { day: true, kind: true, gemstoneId: true, count: true, isDemo: true },
  });
  return rollupRows(rows);
}

/**
 * Median minutes from a buyer's first enquiry message to the seller's first reply, for enquiries started in the
 * range. Computed in SQL with percentile_cont. Null when no enquiry in the range has been answered.
 */
export async function firstResponseMedian(
  sellerProfileId: string,
  fromDay: string,
  lastDay: string,
): Promise<{ medianSeconds: number | null; answered: number }> {
  const from = utcDay(fromDay);
  const toExclusive = utcDay(addDays(lastDay, 1));
  const rows = await prisma.$queryRaw<Array<{ median: number | null; n: number }>>`
    SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY t.secs) AS median, count(*)::int AS n
    FROM (
      SELECT EXTRACT(EPOCH FROM (MIN(reply."createdAt") - MIN(buyer."createdAt")))::float8 AS secs
      FROM "Conversation" c
      JOIN "Gemstone" g ON g.id = c."gemstoneId"
      JOIN "SellerProfile" sp ON sp.id = g."sellerId"
      JOIN "Message" buyer ON buyer."conversationId" = c.id AND buyer."senderId" = c."startedById"
      JOIN "Message" reply ON reply."conversationId" = c.id
        AND reply."senderId" = sp."userId" AND reply."createdAt" > buyer."createdAt"
      WHERE c.kind = 'ENQUIRY' AND sp.id = ${sellerProfileId}
        AND c."createdAt" >= ${from} AND c."createdAt" < ${toExclusive}
      GROUP BY c.id
    ) t`;
  const row = rows[0];
  if (!row || row.n === 0 || row.median === null) return { medianSeconds: null, answered: 0 };
  return { medianSeconds: Number(row.median), answered: row.n };
}

/** Titles of the seller's own listings among the given ids. Other sellers' listings are never returned. */
export async function ownListingTitles(sellerProfileId: string, ids: readonly string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const rows = await prisma.gemstone.findMany({
    where: { id: { in: [...ids] }, sellerId: sellerProfileId },
    select: { id: true, title: true },
  });
  return new Map(rows.map((row) => [row.id, row.title]));
}

/** Followers now. Followers are never shown by name. */
export async function followerCount(sellerProfileId: string): Promise<number> {
  return prisma.follow.count({ where: { sellerId: sellerProfileId } });
}
