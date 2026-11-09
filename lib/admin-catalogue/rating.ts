/**
 * Seller rating cache. Recomputed from APPROVED reviews only, after every review decision.
 * Pure: the caller passes the approved ratings and writes the result in the same transaction.
 */

export interface SellerRatingSummary {
  /** Decimal string with 2 places (e.g. "4.67"), or null when there are no approved reviews. */
  ratingAverage: string | null;
  reviewCount: number;
}

export function computeSellerRating(ratings: readonly number[]): SellerRatingSummary {
  const n = ratings.length;
  if (n === 0) return { ratingAverage: null, reviewCount: 0 };
  const sum = ratings.reduce((total, r) => total + r, 0);
  // Round half up to 2 decimal places with integer arithmetic: round(sum * 100 / n).
  const hundredths = Math.floor((sum * 200 + n) / (2 * n));
  const whole = Math.floor(hundredths / 100);
  const frac = String(hundredths % 100).padStart(2, "0");
  return { ratingAverage: `${whole}.${frac}`, reviewCount: n };
}
