import { type CatalogueQuery, catalogueQuerySchema } from "@/lib/listings/schema";

/**
 * Turns raw URL search params into a valid CatalogueQuery. Invalid parts are dropped and the
 * defaults apply: a bad parameter never produces an error page. Pure, so it can be tested.
 */

export type RawSearchParams = Record<string, string | string[] | undefined>;

const KEYS = [
  "q",
  "category",
  "type",
  "shape",
  "origin",
  "treatment",
  "certified",
  "currency",
  "minCarat",
  "maxCarat",
  "minPrice",
  "maxPrice",
  "availability",
  "sort",
  "page",
] as const;

type Key = (typeof KEYS)[number];

const shape = catalogueQuerySchema.shape;

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function parseCatalogueParams(raw: RawSearchParams, forced: { category?: string } = {}): CatalogueQuery {
  const data: Partial<Record<Key, unknown>> = {};

  for (const key of KEYS) {
    const value = firstValue(raw[key])?.trim();
    // Empty strings are "not set". Without this, z.coerce.number("") would become 0.
    if (!value) continue;
    const result = shape[key].safeParse(value);
    if (result.success && result.data !== undefined) data[key] = result.data;
  }

  // An inverted range cannot match anything: drop both bounds rather than show an empty grid.
  if (data.minCarat !== undefined && data.maxCarat !== undefined && (data.minCarat as number) > (data.maxCarat as number)) {
    delete data.minCarat;
    delete data.maxCarat;
  }
  if (data.minPrice !== undefined && data.maxPrice !== undefined && (data.minPrice as number) > (data.maxPrice as number)) {
    delete data.minPrice;
    delete data.maxPrice;
  }

  if (forced.category) data.category = forced.category;

  const parsed = catalogueQuerySchema.safeParse(data);
  if (parsed.success) return parsed.data;
  return catalogueQuerySchema.parse({ ...(forced.category ? { category: forced.category } : {}) });
}

/** Query string for the active filters. Defaults and page 1 are left out. */
export function toSearchParams(query: CatalogueQuery, options: { omit?: readonly Key[] } = {}): URLSearchParams {
  const params = new URLSearchParams();
  const omit = new Set<Key>(["page", ...(options.omit ?? [])]);
  for (const key of KEYS) {
    if (omit.has(key)) continue;
    const value = query[key];
    if (value === undefined || value === null || value === "") continue;
    if (key === "sort" && value === "newest") continue;
    params.set(key, String(value));
  }
  return params;
}

/** Link to another page of results, keeping the active filters. */
export function buildPageHref(
  basePath: string,
  query: CatalogueQuery,
  page: number,
  options: { omit?: readonly Key[] } = {},
): string {
  const params = toSearchParams(query, options);
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}
