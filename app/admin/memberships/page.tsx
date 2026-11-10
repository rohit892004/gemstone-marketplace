import Link from "next/link";
import { Suspense } from "react";
import type { Prisma } from "@/app/generated/prisma/client";
import { DemoBadge } from "@/components/catalogue/badges";
import { ClearOverrideForm, TierOverrideForm } from "@/components/membership/admin-forms";
import { formatDate } from "@/components/admin/admin-ui";
import { requirePageRole } from "@/lib/auth/require-role";
import { prisma } from "@/lib/db/client";
import { TIERS, type Tier } from "@/lib/membership/tiers";

/**
 * Admin memberships: every approved seller with their tier, the last evaluated figures, and the manual override.
 * Filter by tier with ?tier=FREE|PREMIUM|ELITE. Overrides are audited by the membership service.
 */

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const PAGE_SIZE = 25;
const TIER_LABEL: Record<Tier, string> = { FREE: "Free", PREMIUM: "Premium", ELITE: "Elite" };

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

export default function AdminMembershipsPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={null}>
      <MembershipList searchParams={searchParams} />
    </Suspense>
  );
}

function tierWhere(filter: string): Prisma.SellerProfileWhereInput {
  if (filter === "FREE") return { OR: [{ membership: null }, { membership: { is: { tier: "FREE" } } }] };
  if (filter === "PREMIUM" || filter === "ELITE") return { membership: { is: { tier: filter } } };
  return {};
}

async function MembershipList({ searchParams }: { searchParams: SearchParams }) {
  await requirePageRole(["ADMIN"]);
  const params = await searchParams;
  const tierFilter = (TIERS as readonly string[]).includes(first(params.tier)) ? first(params.tier) : "";
  const requestedPage = Number.parseInt(first(params.page), 10);
  const where: Prisma.SellerProfileWhereInput = { approvalStatus: "APPROVED", AND: [tierWhere(tierFilter)] };

  const total = await prisma.sellerProfile.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(Math.max(Number.isFinite(requestedPage) ? requestedPage : 1, 1), pageCount);

  const sellers = await prisma.sellerProfile.findMany({
    where,
    orderBy: [{ businessName: "asc" }, { id: "asc" }],
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    select: {
      id: true,
      businessName: true,
      isDemo: true,
      membership: {
        select: {
          tier: true,
          tierSince: true,
          graceUntil: true,
          graceTier: true,
          manualOverride: true,
          overrideReason: true,
          qualifiedReferrals: true,
          followerCount: true,
          responseRate: true,
          averageRating: true,
          evaluatedAt: true,
        },
      },
    },
  });

  const hrefFor = (p: number) => {
    const q = new URLSearchParams();
    if (tierFilter) q.set("tier", tierFilter);
    if (p > 1) q.set("page", String(p));
    const qs = q.toString();
    return qs ? `/admin/memberships?${qs}` : "/admin/memberships";
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Memberships</h1>
        <div className="flex flex-wrap gap-4 text-sm">
          <Link href="/admin/memberships/rules" className="underline">
            Tier rules
          </Link>
          <Link href="/admin/referrals" className="underline">
            Referrals
          </Link>
        </div>
      </div>

      <nav aria-label="Filter by tier" className="flex flex-wrap gap-2 text-sm">
        {["", ...TIERS].map((value) => {
          const active = value === tierFilter;
          const label = value === "" ? "All" : TIER_LABEL[value as Tier];
          const href = value === "" ? "/admin/memberships" : `/admin/memberships?tier=${value}`;
          return (
            <Link
              key={value || "all"}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`rounded border px-3 py-1 ${active ? "border-stone-900 bg-stone-900 text-white" : "border-stone-300 bg-white"}`}
            >
              {label}
            </Link>
          );
        })}
      </nav>

      <p className="text-sm text-stone-600">
        {total} approved seller{total === 1 ? "" : "s"}. Progress figures are from the last membership review.
      </p>

      {sellers.length === 0 ? (
        <p className="rounded border border-dashed border-stone-300 p-6 text-sm text-stone-600">No sellers match this filter.</p>
      ) : (
        <ul className="space-y-4">
          {sellers.map((seller) => {
            const m = seller.membership;
            const tier: Tier = m?.tier ?? "FREE";
            return (
              <li key={seller.id} className="space-y-4 rounded border border-stone-300 bg-white p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-medium">{seller.businessName}</h2>
                  {seller.isDemo ? <DemoBadge /> : null}
                  <span className="rounded border border-stone-300 px-2 py-0.5 text-xs">Tier: {TIER_LABEL[tier]}</span>
                  {m?.manualOverride ? (
                    <span className="rounded border border-amber-700 px-2 py-0.5 text-xs text-amber-900">Manual override</span>
                  ) : (
                    <span className="text-xs text-stone-600">Set by the rules</span>
                  )}
                </div>
                <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
                  <div>
                    <dt className="text-stone-600">Qualified referrals</dt>
                    <dd>{m?.qualifiedReferrals ?? 0}</dd>
                  </div>
                  <div>
                    <dt className="text-stone-600">Followers</dt>
                    <dd>{m?.followerCount ?? 0}</dd>
                  </div>
                  <div>
                    <dt className="text-stone-600">Response rate</dt>
                    <dd>{m?.responseRate === null || m?.responseRate === undefined ? "No conversations yet" : `${m.responseRate}%`}</dd>
                  </div>
                  <div>
                    <dt className="text-stone-600">Average rating</dt>
                    <dd>{m?.averageRating === null || m?.averageRating === undefined ? "No reviews yet" : m.averageRating.toString()}</dd>
                  </div>
                </dl>
                {m?.manualOverride && m.overrideReason ? (
                  <p className="text-sm text-stone-700">
                    Override reason: {m.overrideReason}. Since {formatDate(m.tierSince)}.
                  </p>
                ) : null}
                {m?.graceUntil ? (
                  <p className="text-sm text-stone-700">
                    Review pending: {TIER_LABEL[m.graceTier ?? tier]} from {formatDate(m.graceUntil)} unless the seller qualifies again.
                  </p>
                ) : null}
                <p className="text-xs text-stone-600">Last reviewed: {m?.evaluatedAt ? formatDate(m.evaluatedAt) : "not yet"}</p>

                <div className="grid gap-4 border-t border-stone-200 pt-4 md:grid-cols-2">
                  <div>
                    <h3 className="mb-2 text-sm font-medium">Manual tier override</h3>
                    <TierOverrideForm sellerId={seller.id} currentTier={tier} />
                  </div>
                  {m?.manualOverride ? (
                    <div>
                      <h3 className="mb-2 text-sm font-medium">Clear override</h3>
                      <ClearOverrideForm sellerId={seller.id} />
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {pageCount > 1 ? (
        <nav aria-label="Pagination" className="flex items-center gap-4 text-sm">
          {page > 1 ? (
            <Link href={hrefFor(page - 1)} className="underline">
              Previous
            </Link>
          ) : (
            <span className="text-stone-400">Previous</span>
          )}
          <span>
            Page {page} of {pageCount}
          </span>
          {page < pageCount ? (
            <Link href={hrefFor(page + 1)} className="underline">
              Next
            </Link>
          ) : (
            <span className="text-stone-400">Next</span>
          )}
        </nav>
      ) : null}
    </div>
  );
}

