import { followerCount, firstResponseMedian, ownListingTitles, rolledThroughDay, sellerRollupRows } from "./seller-queries";
import { lastFigureDay, resolveRange, type ResolvedRange } from "./seller-range";
import { KPI_KINDS, seriesFor, sellerKpis, topListings, type ListingRow, type RollupRow, type SellerKpis } from "./seller-summary";
import { comparisonDays, type RangeDays } from "./seller-trends";
import { dayKey } from "./events";

/**
 * Loads everything the seller analytics page and its CSV export show, for one seller. Every query is scoped to the
 * seller's own profile id. The caller has already checked the seller is signed in and approved.
 */

export interface SellerDashboard {
  range: ResolvedRange;
  today: string;
  rolledThrough: string | null;
  lastFigureDay: string | null;
  /** The figure days of the current window, oldest first. Empty when there is no figure day. */
  days: string[];
  /** Behind when the rollup has not reached yesterday. */
  behind: boolean;
  kpis: SellerKpis | null;
  viewsSeries: number[];
  enquirySeries: number[];
  listings: ListingRow[];
  /** Median minutes-to-first-reply in seconds, and how many enquiries it is based on. Null when no data. */
  responseMedian: { medianSeconds: number | null; answered: number } | null;
  followers: number;
  rows: RollupRow[];
}

export async function loadSellerDashboard(input: {
  sellerProfileId: string;
  requestedRange: RangeDays;
  tierCapDays: number;
  now?: Date;
}): Promise<SellerDashboard> {
  const now = input.now ?? new Date();
  const range = resolveRange(input.requestedRange, input.tierCapDays);
  const today = dayKey(now);
  const rolledThrough = await rolledThroughDay();
  const last = lastFigureDay(now, rolledThrough);
  const yesterday = dayKey(new Date(now.getTime() - 24 * 60 * 60 * 1000));
  const behind = last !== null && last < yesterday;

  const followers = await followerCount(input.sellerProfileId);

  if (last === null) {
    return {
      range,
      today,
      rolledThrough,
      lastFigureDay: null,
      days: [],
      behind,
      kpis: null,
      viewsSeries: [],
      enquirySeries: [],
      listings: [],
      responseMedian: null,
      followers,
      rows: [],
    };
  }

  const { current, previous } = comparisonDays(last, range.days);
  const rows = await sellerRollupRows(input.sellerProfileId, previous[0], last);
  const kpis = sellerKpis(rows, current, previous);

  const ids = [...new Set(rows.filter((row) => row.gemstoneId !== null && current.includes(row.day)).map((row) => row.gemstoneId as string))];
  const titles = await ownListingTitles(input.sellerProfileId, ids);
  const listings = topListings(rows, current, titles);

  const responseMedian = await firstResponseMedian(input.sellerProfileId, current[0], last);

  return {
    range,
    today,
    rolledThrough,
    lastFigureDay: last,
    days: current,
    behind,
    kpis,
    viewsSeries: seriesFor(rows, KPI_KINDS.listingViews, current),
    enquirySeries: seriesFor(rows, KPI_KINDS.enquiries, current),
    listings,
    responseMedian,
    followers,
    rows,
  };
}
