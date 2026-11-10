import { dayKey } from "./events";
import { conversionRate, countsByDay, dailySeries, percentChange, ratePercent, sumByKey, topN } from "./seller-trends";

/**
 * Seller dashboard figures from rollup rows. Pure: the queries load the rows, this file does the sums.
 * Every row here already belongs to the signed-in seller (the query filters by sellerId).
 */

export interface RollupRow {
  /** YYYY-MM-DD (UTC). */
  day: string;
  kind: string;
  gemstoneId: string | null;
  count: number;
  isDemo: boolean;
}

export const KPI_KINDS = {
  profileViews: "PROFILE_VIEW",
  listingViews: "LISTING_VIEW",
  impressions: "LISTING_IMPRESSION",
  wishlistAdds: "WISHLIST_ADD",
  enquiries: "ENQUIRY_STARTED",
  quotationsSent: "QUOTATION_SENT",
  quotationsAccepted: "QUOTATION_ACCEPTED",
  valuationRequests: "VALUATION_REQUESTED",
  follows: "FOLLOW",
} as const;

export function rollupRows(
  rows: ReadonlyArray<{ day: Date; kind: string; gemstoneId: string | null; count: number; isDemo: boolean }>,
): RollupRow[] {
  return rows.map((row) => ({ day: dayKey(row.day), kind: row.kind, gemstoneId: row.gemstoneId, count: row.count, isDemo: row.isDemo }));
}

/** Total of one kind over the given days. */
export function totalFor(rows: readonly RollupRow[], kind: string, days: ReadonlySet<string>): number {
  let total = 0;
  for (const row of rows) if (row.kind === kind && days.has(row.day)) total += row.count;
  return total;
}

/** Daily series for one kind, zero-filled over the days. */
export function seriesFor(rows: readonly RollupRow[], kind: string, days: readonly string[]): number[] {
  const set = new Set(days);
  const counts = countsByDay(rows.filter((row) => row.kind === kind && set.has(row.day)));
  return dailySeries(counts, days);
}

export interface KpiFigure {
  value: number;
  previous: number;
  /** Percent change, null when there is no earlier data to compare. */
  change: number | null;
}

export interface SellerKpis {
  profileViews: KpiFigure;
  listingViews: KpiFigure;
  impressions: KpiFigure;
  wishlistAdds: KpiFigure;
  enquiries: KpiFigure;
  quotationsSent: KpiFigure;
  quotationsAccepted: KpiFigure;
  valuationRequests: KpiFigure;
  newFollows: KpiFigure;
  /** Enquiries as a share of listing views in the current window. Null without views. */
  conversion: number | null;
  /** Accepted as a share of sent in the current window. Null without sent quotations. */
  quotationAcceptance: number | null;
  /** False when no kind has any count in either window. The page shows an empty state, not zeros. */
  hasActivity: boolean;
  /** True when any row in the current window is demo data. */
  hasDemo: boolean;
}

function figure(rows: readonly RollupRow[], kind: string, current: ReadonlySet<string>, previous: ReadonlySet<string>): KpiFigure {
  const value = totalFor(rows, kind, current);
  const before = totalFor(rows, kind, previous);
  return { value, previous: before, change: percentChange(value, before) };
}

/** KPI tiles for the window, each with its change against the previous window of the same length. */
export function sellerKpis(rows: readonly RollupRow[], currentDays: readonly string[], previousDays: readonly string[]): SellerKpis {
  const current = new Set(currentDays);
  const previous = new Set(previousDays);
  const kpis = {
    profileViews: figure(rows, KPI_KINDS.profileViews, current, previous),
    listingViews: figure(rows, KPI_KINDS.listingViews, current, previous),
    impressions: figure(rows, KPI_KINDS.impressions, current, previous),
    wishlistAdds: figure(rows, KPI_KINDS.wishlistAdds, current, previous),
    enquiries: figure(rows, KPI_KINDS.enquiries, current, previous),
    quotationsSent: figure(rows, KPI_KINDS.quotationsSent, current, previous),
    quotationsAccepted: figure(rows, KPI_KINDS.quotationsAccepted, current, previous),
    valuationRequests: figure(rows, KPI_KINDS.valuationRequests, current, previous),
    newFollows: figure(rows, KPI_KINDS.follows, current, previous),
  };
  const inEither = rows.filter((row) => current.has(row.day) || previous.has(row.day));
  return {
    ...kpis,
    conversion: conversionRate(kpis.enquiries.value, kpis.listingViews.value),
    quotationAcceptance: ratePercent(kpis.quotationsAccepted.value, kpis.quotationsSent.value),
    hasActivity: inEither.some((row) => row.count > 0),
    hasDemo: rows.some((row) => row.isDemo && current.has(row.day)),
  };
}

export interface ListingRow {
  gemstoneId: string;
  title: string;
  views: number;
  impressions: number;
  enquiries: number;
  valuationRequests: number;
}

/**
 * The top listings for the window by views, then impressions. Titles come from the caller (only the seller's own
 * listings are loaded), so a listing without a title is left out rather than shown without a name.
 */
export function topListings(
  rows: readonly RollupRow[],
  days: readonly string[],
  titles: ReadonlyMap<string, string>,
  limit = 10,
): ListingRow[] {
  const set = new Set(days);
  const inWindow = rows.filter((row) => row.gemstoneId !== null && set.has(row.day));
  const byKind = (kind: string) =>
    sumByKey(
      inWindow.filter((row) => row.kind === kind),
      (row) => row.gemstoneId,
      (row) => row.count,
    );
  const views = byKind(KPI_KINDS.listingViews);
  const impressions = byKind(KPI_KINDS.impressions);
  const enquiries = byKind(KPI_KINDS.enquiries);
  const valuations = byKind(KPI_KINDS.valuationRequests);

  const ids = new Set([...views.keys(), ...impressions.keys(), ...enquiries.keys(), ...valuations.keys()]);
  const list: ListingRow[] = [...ids]
    .filter((id) => titles.has(id))
    .map((id) => ({
      gemstoneId: id,
      title: titles.get(id) ?? "",
      views: views.get(id) ?? 0,
      impressions: impressions.get(id) ?? 0,
      enquiries: enquiries.get(id) ?? 0,
      valuationRequests: valuations.get(id) ?? 0,
    }));
  return topN(list, (row) => row.views, (row) => row.title, limit);
}

export const SELLER_CSV_HEADER = [
  "Day",
  "Profile views",
  "Listing views",
  "Impressions",
  "Wishlist adds",
  "Enquiries",
  "Quotations sent",
  "Quotations accepted",
  "Valuation requests",
  "New follows",
  "Demo data",
] as const;

/** One CSV row per day of the window, oldest first. Demo is "yes" when any of the day's rows is demo data. */
export function sellerDailyCsvRows(rows: readonly RollupRow[], days: readonly string[]): Array<Array<string | number>> {
  return days.map((day) => {
    const dayRows = rows.filter((row) => row.day === day);
    const total = (kind: string) => dayRows.filter((row) => row.kind === kind).reduce((sum, row) => sum + row.count, 0);
    return [
      day,
      total(KPI_KINDS.profileViews),
      total(KPI_KINDS.listingViews),
      total(KPI_KINDS.impressions),
      total(KPI_KINDS.wishlistAdds),
      total(KPI_KINDS.enquiries),
      total(KPI_KINDS.quotationsSent),
      total(KPI_KINDS.quotationsAccepted),
      total(KPI_KINDS.valuationRequests),
      total(KPI_KINDS.follows),
      dayRows.some((row) => row.isDemo) ? "yes" : "no",
    ];
  });
}
