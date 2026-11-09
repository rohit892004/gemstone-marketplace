/** Shown on seller portfolios. Public pages only show APPROVED sellers, so this is always accurate there. */
export function VerifiedSellerBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-brand-strong">
      <span aria-hidden="true">✓</span> Verified seller
    </span>
  );
}
