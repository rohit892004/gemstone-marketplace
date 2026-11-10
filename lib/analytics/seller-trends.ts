/**
 * Pure analytics maths shared by the seller and platform dashboards: ranges, days, trends, rates, medians and
 * top-N ranking. No database and no clock: callers pass the days they mean.
 */

export const RANGE_OPTIONS = [7, 30, 90] as const;
export type RangeDays = (typeof RANGE_OPTIONS)[number];
export const DEFAULT_RANGE: RangeDays = 30;

/** The range from a query value. Only 7, 30 or 90 are accepted; anything else gives the default (30). */
export function parseRange(value: string | string[] | null | undefined): RangeDays {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number(raw);
  return (RANGE_OPTIONS as readonly number[]).includes(parsed) ? (parsed as RangeDays) : DEFAULT_RANGE;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Adds whole days to a YYYY-MM-DD UTC day. */
export function addDays(day: string, delta: number): string {
  return new Date(Date.parse(day + "T00:00:00.000Z") + delta * DAY_MS).toISOString().slice(0, 10);
}

/** The `days` UTC days ending on `lastDay` (inclusive), oldest first. */
export function dayRange(lastDay: string, days: number): string[] {
  const out: string[] = [];
  for (let i = days - 1; i >= 0; i -= 1) out.push(addDays(lastDay, -i));
  return out;
}

/** The current window and the previous window of the same length. Both end on finished days. */
export function comparisonDays(lastDay: string, days: number): { current: string[]; previous: string[] } {
  return { current: dayRange(lastDay, days), previous: dayRange(addDays(lastDay, -days), days) };
}

/** Unix seconds at UTC midnight, for the chart's x axis. */
export function dayToUnixSeconds(day: string): number {
  return Date.parse(day + "T00:00:00.000Z") / 1000;
}

/**
 * Percentage change from previous to current, rounded to a whole number. Null when there is nothing to compare
 * against (previous is zero but current is not), so the page says "no earlier data" instead of inventing a rise.
 * Zero to zero is no change, not a rise.
 */
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 100);
}

/** A part as a percentage of a whole, one decimal. Null when the whole is zero. */
export function ratePercent(part: number, whole: number): number | null {
  if (whole === 0) return null;
  return Math.round((part / whole) * 1000) / 10;
}

/** Conversion: enquiries as a share of listing views. Null without views. */
export function conversionRate(enquiries: number, listingViews: number): number | null {
  return ratePercent(enquiries, listingViews);
}

/** Median of a list. Null for an empty list. The average of the two middle values for an even count. */
export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** One value per day, in day order. Days with no count are zero. */
export function dailySeries(counts: ReadonlyMap<string, number>, days: readonly string[]): number[] {
  return days.map((day) => counts.get(day) ?? 0);
}

/** Sums counts into a map keyed by day. */
export function countsByDay(rows: ReadonlyArray<{ day: string; count: number }>): Map<string, number> {
  const out = new Map<string, number>();
  for (const row of rows) out.set(row.day, (out.get(row.day) ?? 0) + row.count);
  return out;
}

/**
 * The top N items by score. Zero scores are left out (a zero is not a top item). Ties sort by label so the order
 * is stable between page loads.
 */
export function topN<T>(items: readonly T[], score: (item: T) => number, label: (item: T) => string, n: number): T[] {
  return items
    .filter((item) => score(item) > 0)
    .sort((a, b) => score(b) - score(a) || label(a).localeCompare(label(b)))
    .slice(0, n);
}

/** Sums counts per key, for ranking. */
export function sumByKey<T>(items: readonly T[], key: (item: T) => string | null, count: (item: T) => number): Map<string, number> {
  const out = new Map<string, number>();
  for (const item of items) {
    const k = key(item);
    if (k === null) continue;
    out.set(k, (out.get(k) ?? 0) + count(item));
  }
  return out;
}

/** A change for display: "+12%", "-5%", "No change", or "No earlier data" when there is nothing to compare. */
export function formatChange(change: number | null): string {
  if (change === null) return "No earlier data to compare";
  if (change === 0) return "No change";
  return (change > 0 ? "+" : "\u2212") + Math.abs(change) + "%";
}

/** A duration for display: "under a minute", "12 min", "2.5 hours", "3 days". Null is "No replies yet". */
export function formatDuration(seconds: number | null): string {
  if (seconds === null) return "No replies yet";
  if (seconds < 60) return "under a minute";
  if (seconds < 3600) return Math.round(seconds / 60) + " min";
  if (seconds < 86400) return Math.round((seconds / 3600) * 10) / 10 + " hours";
  return Math.round((seconds / 86400) * 10) / 10 + " days";
}
