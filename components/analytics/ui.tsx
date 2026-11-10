import type { ReactNode } from "react";
import { BarChart3 } from "lucide-react";
import { formatChange, RANGE_OPTIONS, type RangeDays } from "@/lib/analytics/seller-trends";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { StatTile } from "@/components/ui/card";
import { Tabs } from "@/components/ui/tabs";

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
  const lines = [change !== undefined ? `${formatChange(change)} on the previous period` : null, note ?? null].filter(Boolean);
  return <StatTile label={label} value={<span className="break-words">{value}</span>} note={lines.length ? lines.join(". ") : undefined} className="min-w-0" />;
}

export function RangeNav({ basePath, selected, capDays }: { basePath: string; selected: RangeDays; capDays: number }) {
  return (
    <Tabs
      label="Date range"
      items={RANGE_OPTIONS.map((days) => ({
        href: `${basePath}?range=${days}`,
        active: selected === days,
        label: (
          <>
            Last {days} days
            {days > capDays ? <span className="sr-only"> (capped by your plan)</span> : null}
          </>
        ),
      }))}
    />
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
      <p className="border border-dashed border-line p-4 text-sm text-ink-soft">
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
    <EmptyState
      icon={BarChart3}
      title="No activity in this range yet"
      body={children}
      action={
        <ButtonLink href="/seller/listings" variant="secondary">
          Review your listings
        </ButtonLink>
      }
    />
  );
}

