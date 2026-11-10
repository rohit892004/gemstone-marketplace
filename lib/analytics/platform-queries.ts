import { prisma } from "@/lib/db/client";
import { dayKey } from "./events";
import type { PlatformRow } from "./platform-summary";

/**
 * Platform analytics queries (admin only; the callers check the role). Reads the platform rollup rows only:
 * sellerId and gemstoneId are null, and the kinds start with PLATFORM_. Raw events are never read here.
 */

function utcDay(day: string): Date {
  return new Date(day + "T00:00:00.000Z");
}

export async function platformRollupRows(fromDay: string, lastDay: string): Promise<PlatformRow[]> {
  const rows = await prisma.analyticsRollup.findMany({
    where: {
      sellerId: null,
      gemstoneId: null,
      kind: { startsWith: "PLATFORM_" },
      day: { gte: utcDay(fromDay), lte: utcDay(lastDay) },
    },
    select: { day: true, kind: true, count: true, isDemo: true },
  });
  return rows.map((row) => ({ day: dayKey(row.day), kind: row.kind, count: row.count, isDemo: row.isDemo }));
}

/** Category names for the ids the rollup ranked. Unknown ids are left out. */
export async function categoryNames(ids: readonly string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const rows = await prisma.category.findMany({ where: { id: { in: [...ids] } }, select: { id: true, name: true } });
  return new Map(rows.map((row) => [row.id, row.name]));
}
