/**
 * Expert-review threshold. One global value, plus an optional per-category override. Stored in AppSetting as
 * a decimal string of minor units (JSON cannot hold BigInt), or null for "no threshold".
 */
export const EXPERT_THRESHOLD_KEY = "valuation.expertThreshold";

export function categoryThresholdKey(categoryId: string): string {
  return `${EXPERT_THRESHOLD_KEY}.${categoryId}`;
}

/** Reads a stored threshold. Anything that is not a non-negative whole number of minor units counts as no threshold. */
export function parseThresholdSetting(value: unknown): bigint | null {
  if (typeof value !== "string" || !/^\d{1,15}$/.test(value)) return null;
  return BigInt(value);
}

/** The override wins when set. Otherwise the global value applies. Null means no threshold at all. */
export function resolveExpertThreshold(globalMinor: bigint | null, categoryOverrideMinor: bigint | null): bigint | null {
  return categoryOverrideMinor ?? globalMinor;
}
