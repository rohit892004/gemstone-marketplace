import { categoryNames, platformRollupRows } from "./platform-queries";
import { platformKpis, rankedByPrefix, type PlatformKpiFigure, type PlatformRow } from "./platform-summary";
import { lastFigureDay } from "./seller-range";
import { rolledThroughDay } from "./seller-queries";
import { comparisonDays, type RangeDays } from "./seller-trends";
import { dayKey } from "./events";

/**
 * Loads the platform analytics page and its CSV export. Admin only: the callers check the role. Reads platform
 * rollup rows only. There is no tier cap on the platform view.
 */

export interface RankedName {
  key: string;
  name: string;
  count: number;
}

export interface PlatformDashboard {
  range: RangeDays;
  today: string;
  lastFigureDay: string | null;
  behind: boolean;
  /** The figure days of the current window, oldest first. */
  days: string[];
  kpis: PlatformKpiFigure[];
  rows: PlatformRow[];
  topCategories: RankedName[];
  topTerms: RankedName[];
}

export async function loadPlatformDashboard(input: { requestedRange: RangeDays; now?: Date }): Promise<PlatformDashboard> {
  const now = input.now ?? new Date();
  const today = dayKey(now);
  const rolledThrough = await rolledThroughDay();
  const last = lastFigureDay(now, rolledThrough);
  const yesterday = dayKey(new Date(now.getTime() - 24 * 60 * 60 * 1000));
  const behind = last !== null && last < yesterday;
  const range = input.requestedRange;

  if (last === null) {
    return { range, today, lastFigureDay: null, behind, days: [], kpis: [], rows: [], topCategories: [], topTerms: [] };
  }

  const { current, previous } = comparisonDays(last, range);
  const rows = await platformRollupRows(previous[0], last);
  const currentSet = new Set(current);
  const categories = rankedByPrefix(rows, "PLATFORM_TOP_CATEGORY:", currentSet, 10);
  const names = await categoryNames(categories.map((c) => c.key));

  return {
    range,
    today,
    lastFigureDay: last,
    behind,
    days: current,
    kpis: platformKpis(rows, current, previous),
    rows,
    topCategories: categories.map((c) => ({ key: c.key, name: names.get(c.key) ?? "Unknown category", count: c.count })),
    topTerms: rankedByPrefix(rows, "PLATFORM_TOP_TERM:", currentSet, 20).map((t) => ({ key: t.key, name: t.key, count: t.count })),
  };
}
