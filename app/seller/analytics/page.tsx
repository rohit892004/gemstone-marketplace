import Link from "next/link";
import { Suspense } from "react";
import { DemoBadge } from "@/components/catalogue/badges";
import { LineChart } from "@/components/analytics/line-chart";
import { EmptyAnalytics, formatCount, KpiTile, RangeNav, RollupNote } from "@/components/analytics/ui";
import { AwaitingApprovalPage } from "@/components/seller/seller-pages";
import { requireRole } from "@/lib/auth/require-role";
import { loadSellerDashboard, type SellerDashboard } from "@/lib/analytics/seller-dashboard";
import { dayToUnixSeconds, formatDuration, parseRange } from "@/lib/analytics/seller-trends";
import { prisma } from "@/lib/db/client";
import { canExportCsv, type Tier } from "@/lib/membership/tiers";
import { membershipSnapshot } from "@/lib/membership/service";
import { gateApprovedSeller } from "@/lib/seller/approved-gate";
import type { SellerKpis } from "@/lib/analytics/seller-summary";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default function SellerAnalyticsPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={null}>
      <SellerAnalyticsView searchParams={searchParams} />
    </Suspense>
  );
}

const TIER_LABEL: Record<Tier, string> = { FREE: "Free", PREMIUM: "Premium", ELITE: "Elite" };

async function SellerAnalyticsView({ searchParams }: { searchParams: SearchParams }) {
  const state = await gateApprovedSeller();
  if (state !== "approved") return <AwaitingApprovalPage title="Analytics" />;

  const user = await requireRole(["SELLER"], { sellerApproved: true });
  const profile = await prisma.sellerProfile.findUnique({ where: { userId: user.id }, select: { id: true, isDemo: true } });
  if (!profile) return <AwaitingApprovalPage title="Analytics" />;

  const requested = parseRange((await searchParams).range);
  const snapshot = await membershipSnapshot(profile.id);
  const data = await loadSellerDashboard({
    sellerProfileId: profile.id,
    requestedRange: requested,
    tierCapDays: snapshot.rule.analyticsDays,
  });
  const isDemo = profile.isDemo || (data.kpis?.hasDemo ?? false);

  return (
    <section className="mx-auto max-w-6xl space-y-8 px-4 py-10 sm:px-6">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Analytics</h1>
          {isDemo ? <DemoBadge /> : null}
        </div>
        <p className="text-sm text-ink-soft">How buyers find and contact you. Only your own figures are shown.</p>
      </header>

      <div className="space-y-3">
        <RangeNav basePath="/seller/analytics" selected={requested} capDays={data.range.days} />
        {data.range.capped ? (
          <p className="text-sm text-ink-soft">
            Your {TIER_LABEL[snapshot.tier]} plan shows the last {data.range.days} days. Longer history is an Elite benefit.
          </p>
        ) : null}
        <RollupNote lastFigureDay={data.lastFigureDay} today={data.today} behind={data.behind} />
      </div>

      {data.lastFigureDay === null ? null : data.kpis === null || !data.kpis.hasActivity ? (
        <EmptyAnalytics>
          No activity in the last {data.range.days} days yet. Profile visits, listing views, enquiries and follows appear here
          once buyers see your listings.
        </EmptyAnalytics>
      ) : (
        <Figures data={data} kpis={data.kpis} responseRate={snapshot.metrics.responseRate} />
      )}

      <section aria-labelledby="export-heading" className="space-y-2">
        <h2 id="export-heading" className="text-lg font-semibold text-ink">
          Export
        </h2>
        {canExportCsv(snapshot.tier) ? (
          <p>
            <a href={`/seller/analytics/export?range=${requested}`} className="font-medium text-brand underline underline-offset-4">
              Download CSV for the last {data.range.days} days
            </a>
          </p>
        ) : (
          <p className="text-sm text-ink-soft">
            CSV export is an Elite benefit.{" "}
            <Link href="/seller/membership" className="font-medium text-brand underline underline-offset-4">
              See membership
            </Link>
          </p>
        )}
      </section>
    </section>
  );
}

function Figures({
  data,
  kpis,
  responseRate,
}: {
  data: SellerDashboard;
  kpis: SellerKpis;
  responseRate: number | null;
}) {
  const median = data.responseMedian;
  return (
    <>
      <section aria-labelledby="kpi-heading" className="space-y-3">
        <h2 id="kpi-heading" className="text-lg font-semibold text-ink">
          Key figures
        </h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiTile label="Profile visits" value={formatCount(kpis.profileViews.value)} change={kpis.profileViews.change} />
          <KpiTile label="Listing views" value={formatCount(kpis.listingViews.value)} change={kpis.listingViews.change} />
          <KpiTile label="Impressions" value={formatCount(kpis.impressions.value)} change={kpis.impressions.change} />
          <KpiTile label="Wishlist adds" value={formatCount(kpis.wishlistAdds.value)} change={kpis.wishlistAdds.change} />
          <KpiTile label="Enquiries" value={formatCount(kpis.enquiries.value)} change={kpis.enquiries.change} />
          <KpiTile
            label="Conversion"
            value={kpis.conversion === null ? "No views yet" : `${kpis.conversion}%`}
            note="Enquiries as a share of listing views"
          />
          <KpiTile
            label="Response rate"
            value={responseRate === null ? "No enquiries yet" : `${responseRate}%`}
            note="Last 90 days, whatever range is selected"
          />
          <KpiTile
            label="First reply (median)"
            value={formatDuration(median?.medianSeconds ?? null)}
            note={
              median && median.answered > 0
                ? `From ${formatCount(median.answered)} answered enquiries in this range`
                : "Enquiries started in this range"
            }
          />
          <KpiTile
            label="Quotation acceptance"
            value={kpis.quotationAcceptance === null ? "No quotations sent" : `${kpis.quotationAcceptance}%`}
            note={`${formatCount(kpis.quotationsAccepted.value)} accepted of ${formatCount(kpis.quotationsSent.value)} sent`}
          />
          <KpiTile
            label="Valuation requests"
            value={formatCount(kpis.valuationRequests.value)}
            change={kpis.valuationRequests.change}
          />
          <KpiTile label="Followers" value={formatCount(data.followers)} note={`${formatCount(kpis.newFollows.value)} new in this range`} />
        </div>
      </section>

      <section aria-labelledby="trend-heading" className="space-y-3 rounded-lg border border-line bg-surface-raised p-4">
        <h2 id="trend-heading" className="text-lg font-semibold text-ink">
          Daily trend
        </h2>
        <LineChart
          ariaLabel={`Daily listing views and enquiries for the last ${data.range.days} days`}
          times={data.days.map(dayToUnixSeconds)}
          series={[
            { label: "Listing views", values: data.viewsSeries, color: "#1f6f5c" },
            { label: "Enquiries", values: data.enquirySeries, color: "#b45309" },
          ]}
        />
      </section>

      <section aria-labelledby="listings-heading" className="space-y-3">
        <h2 id="listings-heading" className="text-lg font-semibold text-ink">
          Top listings
        </h2>
        {data.listings.length === 0 ? (
          <p className="text-sm text-ink-soft">No listing views in this range yet.</p>
        ) : (
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <caption className="sr-only">Your top listings in the last {data.range.days} days</caption>
              <thead className="border-b border-line text-ink-soft">
                <tr>
                  <th scope="col" className="py-2 pr-4 font-medium">
                    Listing
                  </th>
                  <th scope="col" className="py-2 pr-4 text-right font-medium">
                    Views
                  </th>
                  <th scope="col" className="py-2 pr-4 text-right font-medium">
                    Impressions
                  </th>
                  <th scope="col" className="py-2 pr-4 text-right font-medium">
                    Enquiries
                  </th>
                  <th scope="col" className="py-2 text-right font-medium">
                    Valuation requests
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.listings.map((row) => (
                  <tr key={row.gemstoneId}>
                    <td className="py-3 pr-4 font-medium text-ink">{row.title}</td>
                    <td className="py-3 pr-4 text-right text-ink-soft">{formatCount(row.views)}</td>
                    <td className="py-3 pr-4 text-right text-ink-soft">{formatCount(row.impressions)}</td>
                    <td className="py-3 pr-4 text-right text-ink-soft">{formatCount(row.enquiries)}</td>
                    <td className="py-3 text-right text-ink-soft">{formatCount(row.valuationRequests)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

