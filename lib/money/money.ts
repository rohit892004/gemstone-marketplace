/**
 * Money: integer minor units (paise for INR, cents for USD) + ISO currency code.
 * Never use floats for stored amounts. Parsing and formatting live here only.
 */

export const CURRENCIES = ["INR", "USD"] as const;
export type Currency = (typeof CURRENCIES)[number];

/** Upper bound for a listing price in minor units (10^12 minor = 10^10 major). */
export const MAX_MINOR = BigInt("1000000000000");

export type MoneyParse = { ok: true; minor: bigint } | { ok: false; reason: "format" | "range" };

/**
 * Parses user input such as "12,500" or "12500.5" (major units) into minor units.
 * Accepts at most 2 decimal places. Rejects negative numbers and exponent notation.
 */
export function parseMajorToMinor(input: string): MoneyParse {
  const cleaned = input.trim().replace(/,/g, "");
  if (!/^\d{1,10}(\.\d{1,2})?$/.test(cleaned)) return { ok: false, reason: "format" };
  const [whole, frac = ""] = cleaned.split(".");
  const minor = BigInt(whole) * BigInt(100) + BigInt(frac.padEnd(2, "0"));
  if (minor <= BigInt(0) || minor > MAX_MINOR) return { ok: false, reason: "range" };
  return { ok: true, minor };
}

/** Formats minor units for display. Returns null when there is no price. */
export function formatMoney(minor: bigint | null | undefined, currency: string): string | null {
  if (minor === null || minor === undefined) return null;
  const locale = currency === "INR" ? "en-IN" : "en-US";
  const major = Number(minor) / 100;
  // Whole amounts show no decimals; anything with paise/cents always shows two.
  const hasFraction = BigInt(minor) % BigInt(100) !== BigInt(0);
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(major);
}

export function isCurrency(value: string): value is Currency {
  return (CURRENCIES as readonly string[]).includes(value);
}
