import Link from "next/link";
import { Suspense } from "react";
import { Gift } from "lucide-react";
import type { Prisma } from "@/app/generated/prisma/client";
import { AdminDemoTag, formatDate } from "@/components/admin/admin-ui";
import { ClearFlagForm, VoidReferralForm } from "@/components/membership/admin-forms";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader, SectionHeading } from "@/components/ui/page-header";
import { Tabs } from "@/components/ui/tabs";
import { requirePageRole } from "@/lib/auth/require-role";
import { prisma } from "@/lib/db/client";

/**
 * Admin referrals. The flagged queue comes first: pending referrals with a fraud signal, waiting for a decision.
 * Below it, every referral with a status filter, 25 to a page. Admin only.
 */

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const PAGE_SIZE = 25;
const STATUSES = ["ALL", "PENDING", "QUALIFIED", "VOIDED"] as const;
type StatusFilter = (typeof STATUSES)[number];

const LABEL = "text-[11px] uppercase tracking-[0.18em] text-ink-soft";

const STATUS_TONES: Record<string, BadgeTone> = { PENDING: "warning", QUALIFIED: "success", VOIDED: "neutral" };

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

export default function AdminReferralsPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={null}>
      <ReferralsView searchParams={searchParams} />
    </Suspense>
  );
}

const referralSelect = {
  id: true,
  status: true,
  flagged: true,
  flagReason: true,
  createdAt: true,
  qualifiedAt: true,
  voidedReason: true,
  referrer: { select: { businessName: true } },
  referred: { select: { sellerProfile: { select: { businessName: true } } } },
  isDemo: true,
} satisfies Prisma.ReferralSelect;

async function ReferralsView({ searchParams }: { searchParams: SearchParams }) {
  await requirePageRole(["ADMIN"]);
  const params = await searchParams;
  const statusParam = first(params.status);
  const status: StatusFilter = (STATUSES as readonly string[]).includes(statusParam) ? (statusParam as StatusFilter) : "ALL";
  const requestedPage = Number.parseInt(first(params.page), 10);

  const flagged = await prisma.referral.findMany({
    where: { flagged: true, status: "PENDING" },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: 100,
    select: referralSelect,
  });

  const listWhere: Prisma.ReferralWhereInput = status === "ALL" ? {} : { status };
  const total = await prisma.referral.count({ where: listWhere });
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(Math.max(Number.isFinite(requestedPage) ? requestedPage : 1, 1), pageCount);
  const rows = await prisma.referral.findMany({
    where: listWhere,
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    select: referralSelect,
  });

  const hrefFor = (s: StatusFilter, p: number) => {
    const q = new URLSearchParams();
    if (s !== "ALL") q.set("status", s);
    if (p > 1) q.set("page", String(p));
    const qs = q.toString();
    return qs ? `/admin/referrals?${qs}` : "/admin/referrals";
  };

  const sellerName = (r: { referred: { sellerProfile: { businessName: string } | null } }) =>
    r.referred.sellerProfile?.businessName ?? "No seller profile yet";

  type Row = (typeof rows)[number];
  const columns: Column<Row>[] = [
    { key: "referrer", header: "Referrer", cell: (r) => r.referrer.businessName },
    {
      key: "referred",
      header: "Referred seller",
      cell: (r) => (
        <span className="flex flex-wrap items-center gap-2">
          {sellerName(r)} {r.isDemo ? <AdminDemoTag /> : null}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (r) => (
        <div className="space-y-1">
          <Badge tone={STATUS_TONES[r.status] ?? "neutral"}>{r.status === "PENDING" ? "Pending" : r.status === "QUALIFIED" ? "Qualified" : "Voided"}</Badge>
          {r.status === "QUALIFIED" && r.qualifiedAt ? <span className="block text-[12px] text-ink-soft">{formatDate(r.qualifiedAt)}</span> : null}
          {r.status === "VOIDED" && r.voidedReason ? <span className="block text-[12px] text-ink-soft">{r.voidedReason}</span> : null}
        </div>
      ),
    },
    { key: "flag", header: "Flag", hideOnMobile: true, cell: (r) => (r.flagged ? "Flagged" : "None") },
    { key: "signedUp", header: "Signed up", hideOnMobile: true, cell: (r) => <span className="whitespace-nowrap">{formatDate(r.createdAt)}</span> },
    {
      key: "void",
      header: "Void",
      cell: (r) => (r.status !== "VOIDED" ? <VoidReferralForm referralId={r.id} /> : <span className="text-ink-soft">Voided</span>),
    },
  ];

  return (
    <div className="space-y-12">
      <PageHeader
        eyebrow="Business"
        title="Referrals"
        actions={
          <Link href="/admin/memberships" className={buttonClasses({ variant: "secondary" })}>
            Memberships
          </Link>
        }
      />

      <section className="space-y-6">
        <SectionHeading title={`Flagged for review (${flagged.length})`} />
        <p className="text-[15px] leading-relaxed text-ink-soft">
          These referrals do not qualify automatically. Clear the flag if the sign-up is genuine, or void the referral.
        </p>
        {flagged.length === 0 ? (
          <EmptyState icon={Gift} title="Nothing is waiting for review" body="Flagged referrals appear here before they can qualify." />
        ) : (
          <ul className="space-y-6">
            {flagged.map((r) => (
              <li key={r.id}>
                <Card className="space-y-6 border-accent/60 p-5 sm:p-8">
                  <dl className="grid gap-6 sm:grid-cols-2">
                    <div className="space-y-1">
                      <dt className={LABEL}>Referrer</dt>
                      <dd className="text-[15px] text-ink">{r.referrer.businessName}</dd>
                    </div>
                    <div className="space-y-1">
                      <dt className={LABEL}>Referred seller</dt>
                      <dd className="flex flex-wrap items-center gap-2 text-[15px] text-ink">
                        {sellerName(r)} {r.isDemo ? <AdminDemoTag /> : null}
                      </dd>
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <dt className={LABEL}>Flag reason</dt>
                      <dd className="text-[15px] text-ink">{r.flagReason ?? "Flagged"}</dd>
                    </div>
                    <div className="space-y-1">
                      <dt className={LABEL}>Signed up</dt>
                      <dd className="text-[15px] text-ink">{formatDate(r.createdAt)}</dd>
                    </div>
                  </dl>
                  <div className="grid gap-6 border-t border-line pt-6 md:grid-cols-2">
                    <div className="space-y-4">
                      <h3 className="font-heading text-lg text-ink">Clear flag</h3>
                      <ClearFlagForm referralId={r.id} />
                    </div>
                    <div className="space-y-4">
                      <h3 className="font-heading text-lg text-ink">Void</h3>
                      <VoidReferralForm referralId={r.id} />
                    </div>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-6">
        <SectionHeading title={`All referrals (${total})`} />
        <Tabs
          label="Filter by status"
          items={STATUSES.map((s) => ({
            href: hrefFor(s, 1),
            label: s === "ALL" ? "All" : s.charAt(0) + s.slice(1).toLowerCase(),
            active: s === status,
          }))}
        />

        <DataTable
          caption="All referrals"
          columns={columns}
          rows={rows}
          getRowKey={(r) => r.id}
          empty={<span>No referrals match this filter.</span>}
        />

        {pageCount > 1 ? (
          <nav aria-label="Pagination" className="flex flex-wrap items-center gap-6 text-sm">
            {page > 1 ? (
              <Link href={hrefFor(status, page - 1)} className="inline-flex min-h-11 items-center underline underline-offset-4">
                Previous
              </Link>
            ) : (
              <span className="text-ink-soft">Previous</span>
            )}
            <span className="text-ink-soft">
              Page {page} of {pageCount}
            </span>
            {page < pageCount ? (
              <Link href={hrefFor(status, page + 1)} className="inline-flex min-h-11 items-center underline underline-offset-4">
                Next
              </Link>
            ) : (
              <span className="text-ink-soft">Next</span>
            )}
          </nav>
        ) : null}
      </section>
    </div>
  );
}
