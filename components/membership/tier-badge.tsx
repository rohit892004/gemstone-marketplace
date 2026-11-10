import type { Tier } from "@/lib/membership/tiers";

const TIER_NAME: Record<Tier, string> = {
  FREE: "Free",
  PREMIUM: "Premium",
  ELITE: "Elite",
};

/**
 * The membership badge. Shows the tier name as text, so it never relies on colour. Free members, and any tier whose
 * rule has no badge, show nothing.
 */
export function TierBadge({ tier, hasBadge }: { tier: Tier; hasBadge: boolean }) {
  if (tier === "FREE" || !hasBadge) return null;
  return (
    <span className="inline-flex items-center rounded-full border border-brand px-2.5 py-0.5 text-xs font-medium text-brand-strong">
      {TIER_NAME[tier]} member
    </span>
  );
}

export function tierName(tier: Tier): string {
  return TIER_NAME[tier];
}
