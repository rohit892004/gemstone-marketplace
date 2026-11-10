import { DemoBadge } from "./badges";

/**
 * Average rating with review count. Shows "No reviews yet" for sellers without ratings.
 * Demo ratings carry a Demo label next to them.
 */
export function Rating({ average, count, isDemo }: { average: string | null; count: number; isDemo: boolean }) {
  if (!average || count === 0) {
    return <p className="text-sm text-ink-soft">No reviews yet</p>;
  }
  const value = Number(average);
  return (
    <p className="flex flex-wrap items-center gap-2 text-sm text-ink-soft">
      <span aria-label={`Rated ${value.toFixed(1)} out of 5`} className="font-medium text-ink">
        <span aria-hidden="true" className="text-accent-text">★</span> {value.toFixed(1)}
      </span>
      <span>({count} {count === 1 ? "review" : "reviews"})</span>
      {isDemo ? <DemoBadge /> : null}
    </p>
  );
}
