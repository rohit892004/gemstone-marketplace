import Link from "next/link";
import { Suspense } from "react";
import { BadgeCheck } from "lucide-react";
import type { Prisma } from "@/app/generated/prisma/client";
import { AdminDemoTag, formatDate } from "@/components/admin/admin-ui";
import { ClearOverrideForm, TierOverrideForm } from "@/components/membership/admin-forms";
import { Badge } from "@/components/ui/badge";
import { ButtonLink, buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs } from "@/components/ui/tabs";
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

const LABEL = "text-[11px] uppercase tracking-[0.18em] text-ink-soft";
const SUBHEAD = "font-heading text-lg text-ink";

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
    <div className="space-y-10">
      <PageHeader
        eyebrow="Business"
        title="Memberships"
        actions={
          <>
            <ButtonLink href="/admin/memberships/rules" variant="secondary">
              Tier rules
            </ButtonLink>
            <ButtonLink href="/admin/referrals" variant="secondary">
              Referrals
            </ButtonLink>
          </>
        }
      />

      <Tabs
        label="Filter by tier"
        items={["", ...TIERS].map((value) => ({
          href: value === "" ? "/admin/memberships" : `/admin/memberships?tier=${value}`,
          label: value === "" ? "All" : TIER_LABEL[value as Tier],
          active: value === tierFilter,
        }))}
      />

      <p className="text-sm text-ink-soft">
        {total} approved seller{total === 1 ? "" : "s"}. Progress figures are from the last membership review.
      </p>

      {sellers.length === 0 ? (
        <EmptyState
          icon={BadgeCheck}
          title="No sellers match this filter"
          body="Approved sellers appear here with their tier and progress figures."
          action={
            <Link href="/admin/memberships" className={buttonClasses({ variant: "secondary" })}>
              Show all memberships
            </Link>
          }
        />
      ) : (
        <ul className="space-y-6">
          {sellers.map((seller) => {
            const m = seller.membership;
            const tier: Tier = m?.tier ?? "FREE";
            return (
              <li key={seller.id}>
                <Card className="space-y-6 p-5 sm:p-8">
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="font-heading text-2xl text-ink">{seller.businessName}</h2>
                    {seller.isDemo ? <AdminDemoTag /> : null}
                    <Badge tone="accent">Tier: {TIER_LABEL[tier]}</Badge>
                    {m?.manualOverride ? <Badge tone="warning">Manual override</Badge> : <span className="text-[12px] text-ink-soft">Set by the rules</span>}
                  </div>
                  <dl className="grid gap-6 sm:grid-cols-4">
                    <div className="space-y-1">
                      <dt className={LABEL}>Qualified referrals</dt>
                      <dd className="text-[15px] text-ink tabular-nums">{m?.qualifiedReferrals ?? 0}</dd>
                    </div>
                    <div className="space-y-1">
                      <dt className={LABEL}>Followers</dt>
                      <dd className="text-[15px] text-ink tabular-nums">{m?.followerCount ?? 0}</dd>
                    </div>
                    <div className="space-y-1">
                      <dt className={LABEL}>Response rate</dt>
                      <dd className="text-[15px] text-ink">{m?.responseRate === null || m?.responseRate === undefined ? "No conversations yet" : `${m.responseRate}%`}</dd>
                    </div>
                    <div className="space-y-1">
                      <dt className={LABEL}>Average rating</dt>
                      <dd className="text-[15px] text-ink">{m?.averageRating === null || m?.averageRating === undefined ? "No reviews yet" : m.averageRating.toString()}</dd>
                    </div>
                  </dl>
                  {m?.manualOverride && m.overrideReason ? (
                    <p className="text-sm leading-relaxed text-ink">
                      Override reason: {m.overrideReason}. Since {formatDate(m.tierSince)}.
                    </p>
                  ) : null}
                  {m?.graceUntil ? (
                    <p className="text-sm leading-relaxed text-ink">
                      Review pending: {TIER_LABEL[m.graceTier ?? tier]} from {formatDate(m.graceUntil)} unless the seller qualifies again.
                    </p>
                  ) : null}
                  <p className="text-[12px] text-ink-soft">Last reviewed: {m?.evaluatedAt ? formatDate(m.evaluatedAt) : "not yet"}</p>

                  <div className="grid gap-6 border-t border-line pt-6 md:grid-cols-2">
                    <div className="space-y-4">
                      <h3 className={SUBHEAD}>Manual tier override</h3>
                      <TierOverrideForm sellerId={seller.id} currentTier={tier} />
                    </div>
                    {m?.manualOverride ? (
                      <div className="space-y-4">
                        <h3 className={SUBHEAD}>Clear override</h3>
                        <ClearOverrideForm sellerId={seller.id} />
                      </div>
                    ) : null}
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {pageCount > 1 ? (
        <nav aria-label="Pagination" className="flex flex-wrap items-center gap-6 text-sm">
          {page > 1 ? (
            <Link href={hrefFor(page - 1)} className="inline-flex min-h-11 items-center underline underline-offset-4">
              Previous
            </Link>
          ) : (
            <span className="text-ink-soft">Previous</span>
          )}
          <span className="text-ink-soft">
            Page {page} of {pageCount}
          </span>
          {page < pageCount ? (
            <Link href={hrefFor(page + 1)} className="inline-flex min-h-11 items-center underline underline-offset-4">
              Next
            </Link>
          ) : (
            <span className="text-ink-soft">Next</span>
          )}
        </nav>
      ) : null}
    </div>
  );
}
