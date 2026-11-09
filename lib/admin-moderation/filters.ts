/** Status filters for the admin queues. Unknown values fall back to the default instead of erroring. */

export const REPORT_FILTERS = ["OPEN", "RESOLVED", "DISMISSED", "all"] as const;
export type ReportFilter = (typeof REPORT_FILTERS)[number];

export const REQUIREMENT_FILTERS = ["all", "OPEN", "CLOSED"] as const;
export type RequirementFilter = (typeof REQUIREMENT_FILTERS)[number];

export const REQUIREMENT_PAGE_SIZE = 50;

function pick<T extends string>(value: string | undefined, allowed: readonly T[], fallback: T): T {
  return allowed.find((candidate) => candidate === value) ?? fallback;
}

export function parseReportFilter(value: string | undefined): ReportFilter {
  return pick(value, REPORT_FILTERS, "OPEN");
}

export function parseRequirementFilter(value: string | undefined): RequirementFilter {
  return pick(value, REQUIREMENT_FILTERS, "all");
}

/** Takes the first value when a search param repeats. */
export function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
