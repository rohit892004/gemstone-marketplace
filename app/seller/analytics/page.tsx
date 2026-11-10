import Link from "next/link";
import { Suspense } from "react";
import { DemoTag } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
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
    <div className="space-y-10">
      <PageHeader
        eyebrow="Performance"
        title="Analytics"
        lead="How buyers find and contact you. Only your own figures are shown."
        actions={isDemo ? <DemoTag /> : null}
      />

      <div className="space-y-4">
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

      <section aria-labelledby="export-heading" className="space-y-3 border-t border-line pt-8">
        <h2 id="export-heading" className="font-heading text-2xl text-ink">
          Export
        </h2>
        {canExportCsv(snapshot.tier) ? (
          <p>
            <a
              href={`/seller/analytics/export?range=${requested}`}
              className="inline-flex min-h-11 items-center font-medium text-ink underline underline-offset-4 hover:text-accent-text"
            >
              Download CSV for the last {data.range.days} days
            </a>
          </p>
        ) : (
          <p className="text-sm text-ink-soft">
            CSV export is an Elite benefit.{" "}
            <Link href="/seller/membership" className="font-medium text-ink underline underline-offset-4 hover:text-accent-text">
              See membership
            </Link>
          </p>
        )}
      </section>
    </div>
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
      <section aria-labelledby="kpi-heading" className="space-y-4">
        <h2 id="kpi-heading" className="font-heading text-2xl text-ink sm:text-3xl">
          Key figures
        </h2>
        <div className="grid grid-cols-1 gap-px border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
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

      <section aria-labelledby="trend-heading" className="space-y-4 border border-line bg-surface-raised p-5 sm:p-6">
        <h2 id="trend-heading" className="font-heading text-2xl text-ink sm:text-3xl">
          Daily trend
        </h2>
        <LineChart
          ariaLabel={`Daily listing views and enquiries for the last ${data.range.days} days`}
          times={data.days.map(dayToUnixSeconds)}
          series={[
            { label: "Listing views", values: data.viewsSeries, color: "#1c1a17" },
            { label: "Enquiries", values: data.enquirySeries, color: "#8a6d43" },
          ]}
        />
      </section>

      <section aria-labelledby="listings-heading" className="space-y-4">
        <h2 id="listings-heading" className="font-heading text-2xl text-ink sm:text-3xl">
          Top listings
        </h2>
        {data.listings.length === 0 ? (
          <p className="border border-dashed border-line p-5 text-sm text-ink-soft">No listing views in this range yet.</p>
        ) : (
          <div className="overflow-x-auto border border-line bg-surface-raised">
            <table className="w-full min-w-[560px] border-collapse text-left text-[14px]">
              <caption className="sr-only">Your top listings in the last {data.range.days} days</caption>
              <thead>
                <tr className="border-b border-line">
                  <th scope="col" className="px-4 py-3 text-[11px] font-medium uppercase tracking-[0.18em] text-ink-soft">
                    Listing
                  </th>
                  <th scope="col" className="px-4 py-3 text-right text-[11px] font-medium uppercase tracking-[0.18em] text-ink-soft">
                    Views
                  </th>
                  <th scope="col" className="px-4 py-3 text-right text-[11px] font-medium uppercase tracking-[0.18em] text-ink-soft">
                    Impressions
                  </th>
                  <th scope="col" className="px-4 py-3 text-right text-[11px] font-medium uppercase tracking-[0.18em] text-ink-soft">
                    Enquiries
                  </th>
                  <th scope="col" className="px-4 py-3 text-right text-[11px] font-medium uppercase tracking-[0.18em] text-ink-soft">
                    Valuation requests
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.listings.map((row) => (
                  <tr key={row.gemstoneId} className="border-b border-line last:border-b-0">
                    <td className="px-4 py-3.5 font-heading text-lg text-ink">{row.title}</td>
                    <td className="px-4 py-3.5 text-right tabular-nums text-ink">{formatCount(row.views)}</td>
                    <td className="px-4 py-3.5 text-right tabular-nums text-ink">{formatCount(row.impressions)}</td>
                    <td className="px-4 py-3.5 text-right tabular-nums text-ink">{formatCount(row.enquiries)}</td>
                    <td className="px-4 py-3.5 text-right tabular-nums text-ink">{formatCount(row.valuationRequests)}</td>
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

