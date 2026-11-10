import { ShieldCheck } from "lucide-react";

/** Shown on seller portfolios. Public pages only show APPROVED sellers, so this is always accurate there. */
export function VerifiedSellerBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 border border-accent/40 px-2.5 py-1 text-[11px] uppercase tracking-[0.14em] text-accent-text">
      <ShieldCheck className="h-3.5 w-3.5" strokeWidth={1.25} aria-hidden /> Verified seller
    </span>
  );
}
