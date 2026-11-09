import { DEMO_LABEL } from "@/lib/demo/guard";

/** Shown only when a listing has a VERIFIED, public document. */
export function VerifiedBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-brand-strong">
      <span aria-hidden="true">✓</span> Verified
    </span>
  );
}

/** Labels seeded sample content. Required on every demo seller, listing, rating and review. */
export function DemoBadge() {
  return (
    <span className="inline-flex items-center rounded-full border border-dashed border-ink-soft/40 px-2 py-0.5 text-xs font-medium text-ink-soft">
      {DEMO_LABEL}
    </span>
  );
}
