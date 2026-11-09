/** Search params as Next passes them to pages (Next 16: a Promise). */
export type SearchParams = Record<string, string | string[] | undefined>;

/** First value of a search param, or undefined. */
export function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
