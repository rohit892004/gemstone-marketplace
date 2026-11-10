import { cx } from "./cx";

/** Loading placeholder. Pulses slowly; the global reduced-motion rule stops the pulse. Always has aria-hidden. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cx("animate-pulse bg-line/70", className)} />;
}

/** Grid of product-card-shaped placeholders for a catalogue or list while data loads. */
export function CardSkeletonGrid({ count = 6, label = "Loading" }: { count?: number; label?: string }) {
  return (
    <div role="status" aria-label={label} className="grid grid-cols-1 gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="space-y-5">
          <Skeleton className="aspect-square w-full" />
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      ))}
      <span className="sr-only">{label}</span>
    </div>
  );
}
