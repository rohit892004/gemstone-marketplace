import { DemoTag } from "@/components/ui/badge";
import { Badge } from "@/components/ui/badge";

/** Shown only when a listing has a VERIFIED, public document. */
export function VerifiedBadge() {
  return <Badge tone="verified">Verified</Badge>;
}

/** Labels seeded sample content. Required on every demo seller, listing, rating and review. Quiet by design. */
export function DemoBadge() {
  return <DemoTag />;
}
