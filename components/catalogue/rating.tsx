import { Star } from "lucide-react";
import { DemoBadge } from "./badges";

/**
 * Average rating with review count. Shows "No reviews yet" for sellers without ratings.
 * Demo ratings carry a Demo label next to them.
 */
export function Rating({ average, count, isDemo }: { average: string | null; count: number; isDemo: boolean }) {
  if (!average || count === 0) {
    return <p className="text-[13px] text-ink-soft">No reviews yet</p>;
  }
  const value = Number(average);
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-ink-soft">
      <span aria-label={`Rated ${value.toFixed(1)} out of 5`} className="flex items-center gap-1 font-medium text-ink tabular-nums">
        <Star className="h-3.5 w-3.5 text-accent" strokeWidth={1.25} aria-hidden /> {value.toFixed(1)}
      </span>
      <span>
        ({count} {count === 1 ? "review" : "reviews"})
      </span>
      {isDemo ? <DemoBadge /> : null}
    </p>
  );
}
