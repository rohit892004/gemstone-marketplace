import { Suspense } from "react";
import { LineChart } from "@/components/analytics/line-chart";
import { formatCount, KpiTile, RangeNav, RollupNote } from "@/components/analytics/ui";
import { requirePageRole } from "@/lib/auth/require-role";
import { loadPlatformDashboard, type PlatformDashboard } from "@/lib/analytics/platform-dashboard";
import type { PlatformKpiKey } from "@/lib/analytics/platform-summary";
import { dayToUnixSeconds, parseRange } from "@/lib/analytics/seller-trends";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

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
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Platform analytics</h1>
        <p className="text-sm text-stone-600">Marketplace totals by day. Figures come from the daily rollup, not live tables.</p>
      </header>

      <div className="space-y-3">
        <RangeNav basePath="/admin/analytics" selected={requested} capDays={requested} />
        <RollupNote lastFigureDay={data.lastFigureDay} today={data.today} behind={data.behind} />
        {data.lastFigureDay !== null ? (
          <p>
            <a href={`/admin/analytics/export?range=${requested}`} className="font-medium underline underline-offset-4">
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
      <p className="rounded-md border border-dashed border-stone-300 bg-white p-6 text-center text-stone-700">
        No platform activity recorded in the last {data.range} days.
      </p>
    );
  }

  return (
    <>
      <section aria-labelledby="platform-kpis" className="space-y-3">
        <h2 id="platform-kpis" className="text-lg font-semibold">
          Totals
        </h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          {tiles.map((k) => (
            <KpiTile
              key={k.key}
              label={k.label}
              value={formatCount(k.value)}
              change={k.change}
              note={k.key === "activeUsers" ? "Sum of daily active users" : undefined}
            />
          ))}
        </div>
      </section>

      <section aria-labelledby="signups-chart" className="space-y-3 rounded border border-stone-300 bg-white p-4">
        <h2 id="signups-chart" className="text-lg font-semibold">
          Signups
        </h2>
        <LineChart
          ariaLabel={`Buyer and seller signups per day for the last ${data.range} days`}
          times={times}
          series={[
            { label: "Buyer signups", values: kpi("signupBuyers")?.series ?? [], color: "#1f6f5c" },
            { label: "Seller signups", values: kpi("signupSellers")?.series ?? [], color: "#b45309" },
          ]}
        />
      </section>

      <section aria-labelledby="activity-chart" className="space-y-3 rounded border border-stone-300 bg-white p-4">
        <h2 id="activity-chart" className="text-lg font-semibold">
          Listings and enquiries
        </h2>
        <LineChart
          ariaLabel={`Listings published and enquiries per day for the last ${data.range} days`}
          times={times}
          series={[
            { label: "Listings published", values: kpi("listingsPublished")?.series ?? [], color: "#1f6f5c" },
            { label: "Enquiries", values: kpi("enquiries")?.series ?? [], color: "#b45309" },
          ]}
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
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
  return (
    <section aria-labelledby={`rank-${caption.replace(/\s+/g, "-").toLowerCase()}`} className="space-y-3">
      <h2 id={`rank-${caption.replace(/\s+/g, "-").toLowerCase()}`} className="text-lg font-semibold">
        {caption}
      </h2>
      {rows.length === 0 ? (
        <p className="text-sm text-stone-600">Nothing recorded in this range yet.</p>
      ) : (
        <div className="relative overflow-x-auto">
          <table className="w-full min-w-[320px] text-left text-sm">
            <caption className="sr-only">{caption}</caption>
            <thead className="border-b border-stone-300 text-stone-600">
              <tr>
                <th scope="col" className="py-2 pr-4 font-medium">
                  {heading}
                </th>
                <th scope="col" className="py-2 text-right font-medium">
                  {countHeading}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200">
              {rows.map((row) => (
                <tr key={row.key}>
                  <td className="py-2 pr-4 break-words">{row.name}</td>
                  <td className="py-2 text-right">{formatCount(row.count)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
