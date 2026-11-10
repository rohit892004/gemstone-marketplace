import { Badge } from "@/components/ui/badge";
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
    <Badge tone="accent">{TIER_NAME[tier]} member</Badge>
  );
}

export function tierName(tier: Tier): string {
  return TIER_NAME[tier];
}
