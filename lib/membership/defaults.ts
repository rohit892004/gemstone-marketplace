import type { TierRule } from "./tiers";

/**
 * Placeholder tier rules from the M5 plan. Every value is pending client confirmation. The admin tier-rules editor
 * changes them in the database, and the server reads the database, so these are only the seed defaults.
 */
export const PENDING_CONFIRMATION = "Pending client confirmation";

export const DEFAULT_TIER_RULES: TierRule[] = [
  {
    tier: "FREE",
    activeListingLimit: 25,
    featuredSlots: 0,
    analyticsDays: 30,
    hasBadge: false,
    rankingBoost: 0,
    unlockReferrals: null,
    unlockFollowers: null,
    minResponseRate: 0,
    minRating: null,
  },
  {
    tier: "PREMIUM",
    activeListingLimit: 100,
    featuredSlots: 1,
    analyticsDays: 90,
    hasBadge: true,
    rankingBoost: 10,
    unlockReferrals: 5,
    unlockFollowers: 50,
    minResponseRate: 70,
    minRating: null,
  },
  {
    tier: "ELITE",
    activeListingLimit: null,
    featuredSlots: 3,
    analyticsDays: 365,
    hasBadge: true,
    rankingBoost: 20,
    unlockReferrals: 20,
    unlockFollowers: 250,
    minResponseRate: 85,
    minRating: 4.5,
  },
];
