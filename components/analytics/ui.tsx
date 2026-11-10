import Link from "next/link";
import type { ReactNode } from "react";
import { formatChange, RANGE_OPTIONS, type RangeDays } from "@/lib/analytics/seller-trends";

/** Shared pieces of the analytics pages. Server components: no client state. */

const count = new Intl.NumberFormat("en-IN");

export function formatCount(value: number): string {
  return count.format(value);
}

export function KpiTile({
  label,
  value,
  change,
  note,
}: {
  label: string;
  value: string;
  /** Percent change against the previous period, or null when there is nothing to compare. */
  change?: number | null;
  note?: string;
}) {
  return (
    <div className="min-w-0 rounded-lg border border-line bg-surface-raised p-4">
      <p className="text-xs uppercase tracking-wide text-ink-soft">{label}</p>
      <p className="mt-1 break-words text-2xl font-semibold text-ink">{value}</p>
      {change !== undefined ? <p className="mt-1 text-xs text-ink-soft">{formatChange(change)} on the previous period</p> : null}
      {note ? <p className="mt-1 text-xs text-ink-soft">{note}</p> : null}
    </div>
  );
}

export function RangeNav({ basePath, selected, capDays }: { basePath: string; selected: RangeDays; capDays: number }) {
  return (
    <nav aria-label="Date range">
      <ul className="flex flex-wrap items-center gap-2">
        {RANGE_OPTIONS.map((days) => (
          <li key={days}>
            <Link
              href={`${basePath}?range=${days}`}
              aria-current={selected === days ? "page" : undefined}
              className={`rounded-full border px-3 py-1 text-sm ${
                selected === days ? "border-brand bg-brand text-white" : "border-line text-ink-soft"
              }`}
            >
              Last {days} days
              {days > capDays ? <span className="sr-only"> (capped by your plan)</span> : null}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Says which finished days the figures cover. Today is never included, because rollups run once a day. */
export function RollupNote({
  lastFigureDay,
  today,
  behind,
}: {
  lastFigureDay: string | null;
  today: string;
  /** True when the rollup has not reached yesterday yet. */
  behind: boolean;
}) {
  if (lastFigureDay === null) {
    return (
      <p className="rounded-md border border-dashed border-line p-3 text-sm text-ink-soft">
        The daily rollup has not processed a finished day yet, so there are no figures to show.
      </p>
    );
  }
  return (
    <div className="space-y-1 text-sm text-ink-soft">
      <p>
        Figures cover finished days up to {lastFigureDay}. Today ({today}) is not yet rolled up and is not included.
      </p>
      {behind ? <p>The daily rollup is behind, so the most recent days are not yet included.</p> : null}
    </div>
  );
}

export function EmptyAnalytics({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-line bg-surface-raised p-6 text-center">
      <p className="text-ink">{children}</p>
    </div>
  );
}
