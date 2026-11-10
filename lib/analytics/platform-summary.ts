import { countsByDay, dailySeries, percentChange, sumByKey, topN } from "./seller-trends";

/**
 * Platform dashboard figures from the platform rollup rows (sellerId and gemstoneId null). Pure.
 */

function totalDays(rows: readonly PlatformRow[], kind: string, days: ReadonlySet<string>): number {
  let total = 0;
  for (const row of rows) if (row.kind === kind && days.has(row.day)) total += row.count;
  return total;
}

export interface PlatformRow {
  day: string;
  kind: string;
  count: number;
  /** True for rows seeded as demo history. */
  isDemo?: boolean;
}

/** The business counts shown as KPI tiles, with the rollup kind each one sums. */
export const PLATFORM_KPIS = [
  { key: "signupBuyers", label: "Buyer signups", kind: "PLATFORM_SIGNUP_BUYER" },
  { key: "signupSellers", label: "Seller signups", kind: "PLATFORM_SIGNUP_SELLER" },
  { key: "sellersApproved", label: "Sellers approved", kind: "PLATFORM_SELLER_APPROVED" },
  { key: "listingsPublished", label: "Listings published", kind: "PLATFORM_LISTING_PUBLISHED" },
  { key: "enquiries", label: "Enquiries", kind: "PLATFORM_ENQUIRY" },
  { key: "conversations", label: "Conversations", kind: "PLATFORM_CONVERSATION" },
  { key: "quotations", label: "Quotations", kind: "PLATFORM_QUOTATION" },
  { key: "valuations", label: "Valuations", kind: "PLATFORM_VALUATION" },
  { key: "activeUsers", label: "Active user-days", kind: "PLATFORM_ACTIVE_USER" },
] as const;

export type PlatformKpiKey = (typeof PLATFORM_KPIS)[number]["key"];

export interface PlatformKpiFigure {
  key: PlatformKpiKey;
  label: string;
  value: number;
  previous: number;
  change: number | null;
  /** Daily values in day order, zero-filled. */
  series: number[];
}

/** Each KPI for the window with its change against the previous window of the same length. */
export function platformKpis(rows: readonly PlatformRow[], currentDays: readonly string[], previousDays: readonly string[]): PlatformKpiFigure[] {
  const current = new Set(currentDays);
  const previous = new Set(previousDays);
  return PLATFORM_KPIS.map((kpi) => {
    const value = totalDays(rows, kpi.kind, current);
    const before = totalDays(rows, kpi.kind, previous);
    return {
      key: kpi.key,
      label: kpi.label,
      value,
      previous: before,
      change: percentChange(value, before),
      series: dailySeries(countsByDay(rows.filter((row) => row.kind === kpi.kind)), currentDays),
    };
  });
}

/** Rows whose kind starts with a prefix, summed per suffix (for PLATFORM_TOP_TERM:<term> and so on). */
export function rankedByPrefix(
  rows: readonly PlatformRow[],
  prefix: string,
  days: ReadonlySet<string>,
  limit: number,
): Array<{ key: string; count: number }> {
  const inWindow = rows.filter((row) => row.kind.startsWith(prefix) && days.has(row.day));
  const totals = sumByKey(
    inWindow,
    (row) => row.kind.slice(prefix.length),
    (row) => row.count,
  );
  const list = [...totals.entries()].map(([key, count]) => ({ key, count }));
  return topN(list, (item) => item.count, (item) => item.key, limit);
}

/** One CSV row per day of the window, oldest first, with one column per platform KPI. */
export function platformDailyCsvRows(rows: readonly PlatformRow[], days: readonly string[]): Array<Array<string | number>> {
  return days.map((day) => [
    day,
    ...PLATFORM_KPIS.map((kpi) => rows.filter((row) => row.day === day && row.kind === kpi.kind).reduce((sum, row) => sum + row.count, 0)),
  ]);
}

export const PLATFORM_CSV_HEADER = ["Day", ...PLATFORM_KPIS.map((kpi) => kpi.label)];
