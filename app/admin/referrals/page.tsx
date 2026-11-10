import { DemoBadge } from "@/components/catalogue/badges";
import Link from "next/link";
import { Suspense } from "react";
import type { Prisma } from "@/app/generated/prisma/client";
import { ClearFlagForm, VoidReferralForm } from "@/components/membership/admin-forms";
import { formatDate } from "@/components/admin/admin-ui";
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

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Referrals</h1>
        <Link href="/admin/memberships" className="text-sm underline">
          Memberships
        </Link>
      </div>

      <section aria-labelledby="flagged-heading" className="space-y-4">
        <h2 id="flagged-heading" className="text-lg font-medium">
          Flagged for review ({flagged.length})
        </h2>
        <p className="text-sm text-stone-600">
          These referrals do not qualify automatically. Clear the flag if the sign-up is genuine, or void the referral.
        </p>
        {flagged.length === 0 ? (
          <p className="rounded border border-dashed border-stone-300 p-6 text-sm text-stone-600">Nothing is waiting for review.</p>
        ) : (
          <ul className="space-y-4">
            {flagged.map((r) => (
              <li key={r.id} className="space-y-3 rounded border border-amber-700 bg-white p-4">
                <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-stone-600">Referrer</dt>
                    <dd>{r.referrer.businessName}</dd>
                  </div>
                  <div>
                    <dt className="text-stone-600">Referred seller</dt>
                    <dd>{sellerName(r)} {r.isDemo ? <DemoBadge /> : null}</dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-stone-600">Flag reason</dt>
                    <dd>{r.flagReason ?? "Flagged"}</dd>
                  </div>
                  <div>
                    <dt className="text-stone-600">Signed up</dt>
                    <dd>{formatDate(r.createdAt)}</dd>
                  </div>
                </dl>
                <div className="grid gap-4 border-t border-stone-200 pt-3 md:grid-cols-2">
                  <div>
                    <h3 className="mb-2 text-sm font-medium">Clear flag</h3>
                    <ClearFlagForm referralId={r.id} />
                  </div>
                  <div>
                    <h3 className="mb-2 text-sm font-medium">Void</h3>
                    <VoidReferralForm referralId={r.id} />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="all-heading" className="space-y-4">
        <h2 id="all-heading" className="text-lg font-medium">
          All referrals ({total})
        </h2>
        <nav aria-label="Filter by status" className="flex flex-wrap gap-2 text-sm">
          {STATUSES.map((s) => (
            <Link
              key={s}
              href={hrefFor(s, 1)}
              aria-current={s === status ? "page" : undefined}
              className={`rounded border px-3 py-1 ${s === status ? "border-stone-900 bg-stone-900 text-white" : "border-stone-300 bg-white"}`}
            >
              {s === "ALL" ? "All" : s.charAt(0) + s.slice(1).toLowerCase()}
            </Link>
          ))}
        </nav>

        {rows.length === 0 ? (
          <p className="rounded border border-dashed border-stone-300 p-6 text-sm text-stone-600">No referrals match this filter.</p>
        ) : (
          <div className="relative overflow-x-auto rounded border border-stone-300 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-stone-100 text-xs uppercase tracking-wide text-stone-600">
                <tr>
                  <th scope="col" className="px-3 py-2">Referrer</th>
                  <th scope="col" className="px-3 py-2">Referred seller</th>
                  <th scope="col" className="px-3 py-2">Status</th>
                  <th scope="col" className="px-3 py-2">Flag</th>
                  <th scope="col" className="px-3 py-2">Signed up</th>
                  <th scope="col" className="px-3 py-2">Void</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-stone-200 align-top">
                    <td className="px-3 py-2">{r.referrer.businessName}</td>
                    <td className="px-3 py-2">{sellerName(r)} {r.isDemo ? <DemoBadge /> : null}</td>
                    <td className="px-3 py-2">
                      {r.status === "PENDING" ? "Pending" : r.status === "QUALIFIED" ? "Qualified" : "Voided"}
                      {r.status === "QUALIFIED" && r.qualifiedAt ? <span className="block text-xs text-stone-600">{formatDate(r.qualifiedAt)}</span> : null}
                      {r.status === "VOIDED" && r.voidedReason ? <span className="block text-xs text-stone-600">{r.voidedReason}</span> : null}
                    </td>
                    <td className="px-3 py-2">{r.flagged ? "Flagged" : "None"}</td>
                    <td className="px-3 py-2">{formatDate(r.createdAt)}</td>
                    <td className="px-3 py-2 min-w-56">
                      {r.status !== "VOIDED" ? <VoidReferralForm referralId={r.id} /> : <span className="text-stone-600">Voided</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pageCount > 1 ? (
          <nav aria-label="Pagination" className="flex items-center gap-4 text-sm">
            {page > 1 ? (
              <Link href={hrefFor(status, page - 1)} className="underline">
                Previous
              </Link>
            ) : (
              <span className="text-stone-400">Previous</span>
            )}
            <span>
              Page {page} of {pageCount}
            </span>
            {page < pageCount ? (
              <Link href={hrefFor(status, page + 1)} className="underline">
                Next
              </Link>
            ) : (
              <span className="text-stone-400">Next</span>
            )}
          </nav>
        ) : null}
      </section>
    </div>
  );
}
