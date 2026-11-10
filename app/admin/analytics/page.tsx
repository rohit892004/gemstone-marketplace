import { Suspense } from "react";
import { BarChart3, Download, Users } from "lucide-react";
import { LineChart } from "@/components/analytics/line-chart";
import { formatCount, RollupNote } from "@/components/analytics/ui";
import { AdminDemoTag } from "@/components/admin/admin-ui";
import { Card, StatTile } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader, SectionHeading } from "@/components/ui/page-header";
import { Tabs } from "@/components/ui/tabs";
import { requirePageRole } from "@/lib/auth/require-role";
import { loadPlatformDashboard, type PlatformDashboard } from "@/lib/analytics/platform-dashboard";
import type { PlatformKpiKey } from "@/lib/analytics/platform-summary";
import { dayToUnixSeconds, formatChange, parseRange, RANGE_OPTIONS } from "@/lib/analytics/seller-trends";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const INK = "#1c1a17";
const GOLD = "#8a6d43";

export default function AdminAnalyticsPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={null}>
      <AdminAnalyticsView searchParams={searchParams} />
    </Suspense>
  );
}

async function AdminAnalyticsView({ searchParams }: { searchParams: SearchParams }) {
  await requirePageRole(["ADMIN"]);
  const requested = parseRange((await searchParams).range);
  const data = await loadPlatformDashboard({ requestedRange: requested });

  return (
    <div className="space-y-10">
      <PageHeader eyebrow="Business" title="Platform analytics" lead="Marketplace totals by day. Figures come from the daily rollup, not live tables." />

      <div className="space-y-6">
        <Tabs
          label="Date range"
          items={RANGE_OPTIONS.map((days) => ({
            href: `/admin/analytics?range=${days}`,
            label: `Last ${days} days`,
            active: requested === days,
          }))}
        />
        <RollupNote lastFigureDay={data.lastFigureDay} today={data.today} behind={data.behind} />
        {data.hasDemo ? (
          <p className="flex flex-wrap items-center gap-3 border-l-2 border-accent bg-surface-raised px-5 py-4 text-sm leading-relaxed text-ink">
            <AdminDemoTag /> The totals in this window include demo history. Demo rows are labelled and are not real activity.
          </p>
        ) : null}
        {data.lastFigureDay !== null ? (
          <p>
            <a
              href={`/admin/analytics/export?range=${requested}`}
              className="inline-flex min-h-11 items-center gap-2 font-medium text-ink underline underline-offset-4 hover:text-accent-text"
            >
              <Download className="h-4 w-4" strokeWidth={1.25} aria-hidden />
              Download CSV for the last {requested} days
            </a>
          </p>
        ) : null}
      </div>

      {data.lastFigureDay === null ? null : <Figures data={data} />}
    </div>
  );
}

function Figures({ data }: { data: PlatformDashboard }) {
  const byKey = new Map(data.kpis.map((k) => [k.key, k]));
  const kpi = (key: PlatformKpiKey) => byKey.get(key);
  const tiles = data.kpis;
  const empty = tiles.every((k) => k.value === 0 && k.previous === 0);
  const times = data.days.map(dayToUnixSeconds);

  if (empty) {
    return (
      <EmptyState
        icon={BarChart3}
        title="No platform activity yet"
        body={`No platform activity recorded in the last ${data.range} days. Figures appear here after the next daily rollup.`}
      />
    );
  }

  return (
    <>
      <section className="space-y-6">
        <SectionHeading title="Totals" />
        <div className="grid grid-cols-2 gap-px border border-line bg-line xl:grid-cols-5">
          {tiles.map((k) => (
            <div key={k.key} className="min-w-0 bg-surface-raised">
              <StatTile
                className="h-full border-0"
                label={k.label}
                value={formatCount(k.value)}
                icon={<Users className="h-5 w-5" strokeWidth={1.25} aria-hidden />}
                note={
                  <>
                    {k.change !== undefined ? <span className="block">{`${formatChange(k.change)} on the previous period`}</span> : null}
                    {k.key === "activeUsers" ? <span className="block">Sum of daily active users</span> : null}
                  </>
                }
              />
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-6">
        <SectionHeading title="Signups" />
        <Card className="p-5 sm:p-8">
          <LineChart
            ariaLabel={`Buyer and seller signups per day for the last ${data.range} days`}
            times={times}
            series={[
              { label: "Buyer signups", values: kpi("signupBuyers")?.series ?? [], color: INK },
              { label: "Seller signups", values: kpi("signupSellers")?.series ?? [], color: GOLD },
            ]}
          />
        </Card>
      </section>

      <section className="space-y-6">
        <SectionHeading title="Listings and enquiries" />
        <Card className="p-5 sm:p-8">
          <LineChart
            ariaLabel={`Listings published and enquiries per day for the last ${data.range} days`}
            times={times}
            series={[
              { label: "Listings published", values: kpi("listingsPublished")?.series ?? [], color: INK },
              { label: "Enquiries", values: kpi("enquiries")?.series ?? [], color: GOLD },
            ]}
          />
        </Card>
      </section>

      <div className="grid grid-cols-1 gap-12 lg:grid-cols-2">
        <RankTable caption="Top categories" heading="Category" countHeading="Listing views" rows={data.topCategories} />
        <RankTable caption="Top searches" heading="Search" countHeading="Searches" rows={data.topTerms} />
      </div>
    </>
  );
}

function RankTable({
  caption,
  heading,
  countHeading,
  rows,
}: {
  caption: string;
  heading: string;
  countHeading: string;
  rows: PlatformDashboard["topCategories"];
}) {
  type Row = PlatformDashboard["topCategories"][number];
  const columns: Column<Row>[] = [
    { key: "name", header: heading, cell: (row) => <span className="break-words">{row.name}</span> },
    { key: "count", header: countHeading, align: "right", cell: (row) => formatCount(row.count) },
  ];
  return (
    <section className="min-w-0 space-y-6">
      <SectionHeading title={caption} />
      <DataTable caption={caption} columns={columns} rows={rows} getRowKey={(row) => row.key} empty={<span>Nothing recorded in this range yet.</span>} />
    </section>
  );
}
