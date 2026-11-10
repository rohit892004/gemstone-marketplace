import type { ContentTypeName } from "./status";

/**
 * Pure query-string helpers for the public list pages (education, news, reference). They only shape input;
 * the service does the filtering.
 */

export const EDUCATION_TYPES = ["EDUCATION", "GUIDE", "RESEARCH"] as const satisfies readonly ContentTypeName[];

export const EDUCATION_TABS = [
  { id: "all", label: "All", type: undefined },
  { id: "education", label: "Education", type: "EDUCATION" },
  { id: "guides", label: "Guides", type: "GUIDE" },
  { id: "research", label: "Research", type: "RESEARCH" },
] as const;

export type EducationTab = (typeof EDUCATION_TABS)[number];

/** Unknown or missing tab values fall back to "all". */
export function parseEducationTab(value: string | undefined): EducationTab {
  return EDUCATION_TABS.find((tab) => tab.id === value) ?? EDUCATION_TABS[0];
}

/** Service filter for a tab: one type, or every education type for "all". Never includes NEWS. */
export function educationTabFilter(tab: EducationTab): { type?: ContentTypeName; types?: ContentTypeName[] } {
  return tab.type ? { type: tab.type } : { types: [...EDUCATION_TYPES] };
}

export const NEWS_CATEGORIES = ["Market", "Trade", "Mining", "Certification", "Policy"] as const;
export type NewsCategory = (typeof NEWS_CATEGORIES)[number];

/** Exact match against the fixed list, so a crafted query cannot filter on arbitrary text. */
export function parseNewsCategory(value: string | undefined): NewsCategory | null {
  return NEWS_CATEGORIES.find((category) => category === value) ?? null;
}

export const SEARCH_MAX = 120;

/** Search text: control characters removed, trimmed, capped in length. */
export function cleanSearch(value: string | undefined): string {
  return (value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, SEARCH_MAX);
}

/** Tag from a query string, normalised the same way the service stores tags. Null when nothing usable is left. */
export function cleanTag(value: string | undefined): string | null {
  const tag = (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9 -]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 32);
  return tag === "" ? null : tag;
}

/** 1-based page number from a query string. Anything odd becomes page 1. */
export function parsePageNumber(value: string | undefined, maxPage = 1000): number {
  const n = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, maxPage);
}

export function pageCount(total: number, perPage: number): number {
  return Math.max(1, Math.ceil(total / perPage));
}
