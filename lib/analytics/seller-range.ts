import { addDays, type RangeDays } from "./seller-trends";
import { dayKey } from "./events";

/**
 * Range rules for the dashboards. Pure.
 *
 *  - Figures cover finished UTC days only. Today is never included, because rollups are written once a day.
 *  - The last figure day is yesterday, or earlier when the rollup job has not yet processed yesterday. The page
 *    shows that day, so a stale rollup is visible rather than read as zeros.
 *  - The requested range is capped to the tier's history (analyticsWindow). The page says when a cap applies.
 */

export interface ResolvedRange {
  requested: RangeDays;
  days: number;
  capped: boolean;
}

/** The range actually shown: the request, capped to the tier's analytics history. */
export function resolveRange(requested: RangeDays, tierCapDays: number): ResolvedRange {
  const days = Math.min(requested, tierCapDays);
  return { requested, days, capped: days < requested };
}

/**
 * The last finished day to report. Yesterday (UTC) normally; earlier when the rollup has only reached an earlier day.
 * Null when the rollup has never run, so the caller shows "not yet rolled up" instead of zeros.
 */
export function lastFigureDay(now: Date, rolledThrough: string | null): string | null {
  const yesterday = addDays(dayKey(now), -1);
  if (rolledThrough === null) return null;
  return rolledThrough < yesterday ? rolledThrough : yesterday;
}
