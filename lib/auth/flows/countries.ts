/** Buyer country choices. India first, then a short list. Stored as the display name. */
export const BUYER_COUNTRIES = [
  "India",
  "Australia",
  "Canada",
  "Germany",
  "Hong Kong",
  "Japan",
  "Singapore",
  "Sri Lanka",
  "Thailand",
  "United Arab Emirates",
  "United Kingdom",
  "United States",
  "Other",
] as const;

export function isBuyerCountry(value: string): boolean {
  return (BUYER_COUNTRIES as readonly string[]).includes(value);
}
