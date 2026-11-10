/**
 * Membership tier rules. Pure: no database, no clock except the `now` passed in. The rollup job calls evaluateTier
 * with the metrics it has just computed. The server checks canPublishNewListing and featuredAvailable on every write.
 *
 *  - Upgrades are immediate.
 *  - Downgrades start a 14-day grace period. The tier stays until the grace ends, then drops. If the seller qualifies
 *    again during the grace, the grace is cancelled.
 *  - An admin override holds the tier as set. The evaluation does not change it.
 *  - Sellers over a lower listing limit keep their listings. They cannot publish new ones until they are under it.
 */

export const TIERS = ["FREE", "PREMIUM", "ELITE"] as const;
export type Tier = (typeof TIERS)[number];

export const GRACE_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

/** CSV export of analytics is an Elite benefit. Fixed in code, not in the editable table. */
export const CSV_EXPORT_TIERS: readonly Tier[] = ["ELITE"];

export interface TierRule {
  tier: Tier;
  /** Null means unlimited. */
  activeListingLimit: number | null;
  featuredSlots: number;
  analyticsDays: number;
  hasBadge: boolean;
  rankingBoost: number;
  /** Qualified referrals that unlock the tier (either this or unlockFollowers is enough). Null for Free. */
  unlockReferrals: number | null;
  unlockFollowers: number | null;
  /** Percent. Required for unlocking. */
  minResponseRate: number;
  /** Average rating from approved, non-demo reviews. Null means no rating requirement. */
  minRating: number | null;
}

export interface SellerMetrics {
  qualifiedReferrals: number;
  followerCount: number;
  /** Percent, or null with no buyer conversations yet. */
  responseRate: number | null;
  /** Average of approved, non-demo reviews, or null with none. */
  averageRating: number | null;
}

export interface TierState {
  tier: Tier;
  graceUntil: Date | null;
  graceTier: Tier | null;
  manualOverride: boolean;
}

export interface Criterion {
  key: "referrals" | "followers" | "response" | "rating";
  label: string;
  required: number;
  current: number;
  met: boolean;
}

export interface UnlockReport {
  /** Met when the reach criteria and the quality criteria are both met. */
  eligible: boolean;
  /** Referrals and followers. At least one must be met. */
  reachCriteria: Criterion[];
  /** Response rate, and rating when the tier needs one. All must be met. */
  qualityCriteria: Criterion[];
}

export function tierIndex(tier: Tier): number {
  return TIERS.indexOf(tier);
}

export function ruleFor(rules: readonly TierRule[], tier: Tier): TierRule {
  const rule = rules.find((r) => r.tier === tier);
  if (!rule) throw new Error("No tier rule for " + tier);
  return rule;
}

/** Progress toward a tier, one line per criterion. Free has no requirements and is always eligible. */
export function unlockReport(rule: TierRule, metrics: SellerMetrics): UnlockReport {
  if (rule.unlockReferrals === null && rule.unlockFollowers === null) {
    return { eligible: true, reachCriteria: [], qualityCriteria: [] };
  }
  const reachCriteria: Criterion[] = [];
  if (rule.unlockReferrals !== null) {
    reachCriteria.push({
      key: "referrals",
      label: "Qualified referrals",
      required: rule.unlockReferrals,
      current: metrics.qualifiedReferrals,
      met: metrics.qualifiedReferrals >= rule.unlockReferrals,
    });
  }
  if (rule.unlockFollowers !== null) {
    reachCriteria.push({
      key: "followers",
      label: "Followers",
      required: rule.unlockFollowers,
      current: metrics.followerCount,
      met: metrics.followerCount >= rule.unlockFollowers,
    });
  }
  const qualityCriteria: Criterion[] = [
    {
      key: "response",
      label: "Response rate",
      required: rule.minResponseRate,
      current: metrics.responseRate ?? 0,
      met: metrics.responseRate !== null && metrics.responseRate >= rule.minResponseRate,
    },
  ];
  if (rule.minRating !== null) {
    qualityCriteria.push({
      key: "rating",
      label: "Average rating",
      required: rule.minRating,
      current: metrics.averageRating ?? 0,
      met: metrics.averageRating !== null && metrics.averageRating >= rule.minRating,
    });
  }
  const reachMet = reachCriteria.some((c) => c.met);
  const qualityMet = qualityCriteria.every((c) => c.met);
  return { eligible: reachMet && qualityMet, reachCriteria, qualityCriteria };
}

/** The highest tier whose requirements the seller meets. Free when none apply. */
export function highestEligibleTier(rules: readonly TierRule[], metrics: SellerMetrics): Tier {
  let best: Tier = "FREE";
  for (const tier of TIERS) {
    if (tierIndex(tier) <= tierIndex(best)) continue;
    if (unlockReport(ruleFor(rules, tier), metrics).eligible) best = tier;
  }
  return best;
}

export interface TierDecision extends TierState {
  change: "NONE" | "UPGRADED" | "GRACE_STARTED" | "GRACE_CANCELLED" | "DOWNGRADED";
}

/** One evaluation step. Returns the new state and what changed. Call it on every rollup run. */
export function evaluateTier(input: {
  rules: readonly TierRule[];
  metrics: SellerMetrics;
  state: TierState;
  now: Date;
}): TierDecision {
  const { rules, metrics, state, now } = input;
  if (state.manualOverride) return { ...state, change: "NONE" };

  const target = highestEligibleTier(rules, metrics);
  const current = state.tier;

  if (tierIndex(target) > tierIndex(current)) {
    return { tier: target, graceUntil: null, graceTier: null, manualOverride: false, change: "UPGRADED" };
  }

  if (tierIndex(target) === tierIndex(current)) {
    if (state.graceUntil !== null) {
      return { tier: current, graceUntil: null, graceTier: null, manualOverride: false, change: "GRACE_CANCELLED" };
    }
    return { ...state, change: "NONE" };
  }

  // The seller now qualifies for a lower tier.
  if (state.graceUntil === null) {
    return {
      tier: current,
      graceUntil: new Date(now.getTime() + GRACE_DAYS * DAY_MS),
      graceTier: target,
      manualOverride: false,
      change: "GRACE_STARTED",
    };
  }
  if (now.getTime() >= state.graceUntil.getTime()) {
    return { tier: target, graceUntil: null, graceTier: null, manualOverride: false, change: "DOWNGRADED" };
  }
  return { ...state, graceTier: target, change: "NONE" };
}

/**
 * Listing limit check for a new publish. Existing listings are never removed by a downgrade. Only new publishes
 * are refused while the seller is at or over the limit.
 */
export function canPublishNewListing(rule: TierRule, activePublished: number): { ok: true } | { ok: false; limit: number } {
  if (rule.activeListingLimit === null) return { ok: true };
  if (activePublished < rule.activeListingLimit) return { ok: true };
  return { ok: false, limit: rule.activeListingLimit };
}

/** A seller-chosen featured slot is free when fewer than the tier's slots are in use. */
export function featuredAvailable(rule: TierRule, featuredInUse: number): boolean {
  return featuredInUse < rule.featuredSlots;
}

/** Analytics history the tier shows: the requested window, capped at the tier's history. */
export function analyticsWindow(rule: TierRule, requestedDays: number): number {
  return Math.min(requestedDays, rule.analyticsDays);
}

export function canExportCsv(tier: Tier): boolean {
  return CSV_EXPORT_TIERS.includes(tier);
}
