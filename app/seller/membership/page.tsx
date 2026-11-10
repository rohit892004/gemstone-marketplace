import { DemoBadge } from "@/components/catalogue/badges";
import { Suspense } from "react";
import { AwaitingApprovalPage } from "@/components/seller/seller-pages";
import { CopyLink } from "@/components/membership/copy-button";
import { CriterionProgress } from "@/components/membership/progress-bar";
import { TierBadge, tierName } from "@/components/membership/tier-badge";
import { getEnv } from "@/lib/config/env";
import { requireRole } from "@/lib/auth/require-role";
import { prisma } from "@/lib/db/client";
import { gateApprovedSeller } from "@/lib/seller/approved-gate";
import { PENDING_CONFIRMATION } from "@/lib/membership/defaults";
import { criterionFormat } from "@/lib/membership/progress";
import { loadTierRules, membershipSnapshot, MembershipError, ensureReferralCode } from "@/lib/membership/service";
import { canExportCsv, TIERS, type Tier, type TierRule, type UnlockReport } from "@/lib/membership/tiers";

/**
 * Seller membership: current tier, progress toward the next tier, the benefits comparison, and the referral link.
 * Approved sellers only. Upgrade and Rewards are placeholders: no payments. Referral counts are totals only; the
 * referred people are never shown to the seller.
 */

export default function SellerMembershipPage() {
  return (
    <Suspense fallback={null}>
      <MembershipView />
    </Suspense>
  );
}

const dateFormat = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" });

function analyticsText(days: number): string {
  if (days >= 365) return `${Math.round(days / 30)} months`;
  return `${days} days`;
}

function unlockText(rule: TierRule): string {
  if (rule.unlockReferrals === null && rule.unlockFollowers === null) return "No requirement";
  const reach = [
    rule.unlockReferrals !== null ? `${rule.unlockReferrals} qualified referrals` : null,
    rule.unlockFollowers !== null ? `${rule.unlockFollowers} followers` : null,
  ]
    .filter(Boolean)
    .join(" or ");
  const quality = [`${rule.minResponseRate}% response rate`, rule.minRating !== null ? `${rule.minRating.toFixed(1)} average rating` : null]
    .filter(Boolean)
    .join(" and ");
  return `${reach}, plus ${quality}`;
}

function summarise(report: UnlockReport | null): string | null {
  if (!report) return null;
  return report.eligible ? "All requirements met" : "Requirements not yet met";
}

async function MembershipView() {
  const gate = await gateApprovedSeller();
  if (gate !== "approved") return <AwaitingApprovalPage title="Membership" />;

  const user = await requireRole(["SELLER"], { sellerApproved: true });
  const seller = await prisma.sellerProfile.findUnique({ where: { userId: user.id }, select: { id: true, slug: true, isDemo: true } });
  if (!seller) return <AwaitingApprovalPage title="Membership" />;

  const [snapshot, rules, referralCounts] = await Promise.all([
    membershipSnapshot(seller.id),
    loadTierRules(),
    prisma.referral.groupBy({ by: ["status"], where: { referrerSellerId: seller.id }, _count: { _all: true } }),
  ]);

  let referralCode: string | null = null;
  try {
    referralCode = await ensureReferralCode(seller.id);
  } catch (error) {
    if (!(error instanceof MembershipError)) throw error;
  }
  const countFor = (status: string) => referralCounts.find((c) => c.status === status)?._count._all ?? 0;
  const qualified = countFor("QUALIFIED");
  const pending = countFor("PENDING");
  const base = getEnv().APP_URL.replace(/\/+$/, "");
  const referralLink = referralCode ? `${base}/register/seller?ref=${referralCode}` : null;

  const { tier, rule, nextTier, nextUnlock } = snapshot;
  const nextRule = nextTier ? rules.find((r) => r.tier === nextTier) ?? null : null;

  return (
    <section className="mx-auto max-w-5xl space-y-12 px-4 py-10 sm:px-6">
      <header className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          Membership {seller?.isDemo ? <DemoBadge /> : null}
        </h1>
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-lg text-ink">
            Current membership: <strong className="font-semibold">{tierName(tier)}</strong>
          </p>
          <TierBadge tier={tier} hasBadge={rule.hasBadge} />
        </div>
        {snapshot.graceUntil ? (
          <p role="status" className="rounded-md border border-amber-700 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Your membership stays the same until {dateFormat.format(snapshot.graceUntil)}, then changes unless you qualify again.
          </p>
        ) : null}
        {snapshot.manualOverride ? (
          <p role="status" className="rounded-md border border-line bg-surface-raised px-4 py-3 text-sm text-ink">
            Set by the Gemstone Selections team.
            {snapshot.overrideReason ? ` Reason: ${snapshot.overrideReason}` : ""}
          </p>
        ) : null}
        <p className="text-sm text-ink-soft">
          Listings in use: {snapshot.publishedListings}
          {rule.activeListingLimit === null ? " (unlimited)" : ` of ${rule.activeListingLimit}`}. Featured in use:{" "}
          {snapshot.featuredInUse} of {rule.featuredSlots}.
        </p>
      </header>

      <section aria-labelledby="progress-heading" className="space-y-6">
        <h2 id="progress-heading" className="text-xl font-semibold text-ink">
          Progress to the next tier
        </h2>
        {nextTier && nextUnlock && nextRule ? (
          <div className="space-y-6 rounded-lg border border-line bg-surface-raised p-5">
            <p className="text-sm text-ink-soft">
              Next tier: <strong className="font-medium text-ink">{tierName(nextTier)}</strong>. Status: {summarise(nextUnlock)}.
            </p>
            {nextUnlock.reachCriteria.length > 0 ? (
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-ink">Reach one of these</h3>
                {nextUnlock.reachCriteria.map((c) => (
                  <CriterionProgress key={c.key} criterion={c} format={criterionFormat(c.key)} />
                ))}
              </div>
            ) : null}
            {nextUnlock.qualityCriteria.length > 0 ? (
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-ink">All of these</h3>
                {nextUnlock.qualityCriteria.map((c) => (
                  <CriterionProgress key={c.key} criterion={c} format={criterionFormat(c.key)} />
                ))}
              </div>
            ) : null}
            <p className="text-xs text-ink-soft">Requirements: {unlockText(nextRule)}. {PENDING_CONFIRMATION}.</p>
          </div>
        ) : (
          <p className="rounded-lg border border-line bg-surface-raised p-5 text-sm text-ink">You are on the top membership tier.</p>
        )}
      </section>

      <section aria-labelledby="benefits-heading" className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="benefits-heading" className="text-xl font-semibold text-ink">
            Benefits by tier
          </h2>
          <p className="text-xs text-ink-soft">{PENDING_CONFIRMATION}</p>
        </div>
        <BenefitsTable rules={rules} current={tier} />
      </section>

      <section aria-labelledby="upcoming-heading" className="space-y-4">
        <h2 id="upcoming-heading" className="text-xl font-semibold text-ink">
          Upcoming benefits
        </h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-ink-soft">
          <li>Membership rewards. Details are to be confirmed.</li>
          <li>Further seller tools. Details are to be confirmed.</li>
        </ul>
        <p className="text-sm text-ink-soft">These are not yet available and may change before launch.</p>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" disabled className="rounded-md border border-line px-4 py-2 text-sm font-medium text-ink-soft">
            Upgrade
          </button>
          <button type="button" disabled className="rounded-md border border-line px-4 py-2 text-sm font-medium text-ink-soft">
            Rewards
          </button>
          <span className="text-sm text-ink-soft">Coming soon</span>
        </div>
      </section>

      <section aria-labelledby="referral-heading" className="space-y-5 rounded-lg border border-line bg-surface-raised p-5">
        <h2 id="referral-heading" className="text-xl font-semibold text-ink">
          Refer a seller
        </h2>
        <p className="text-sm text-ink-soft">
          Share your link with a business that wants to sell on Gemstone Selections. A referral counts once the new seller is approved and has
          published a listing.
        </p>
        {referralLink ? (
          <CopyLink id="referral-link" label="Your referral link" value={referralLink} />
        ) : (
          <p className="text-sm text-ink-soft">Your referral link is available once your account is approved.</p>
        )}
        <dl className="grid grid-cols-2 gap-4 text-sm sm:max-w-md">
          <div>
            <dt className="text-ink-soft">Qualified referrals</dt>
            <dd className="text-2xl font-semibold text-ink">{qualified}</dd>
          </div>
          <div>
            <dt className="text-ink-soft">Pending referrals</dt>
            <dd className="text-2xl font-semibold text-ink">{pending}</dd>
          </div>
        </dl>
      </section>
    </section>
  );
}

function BenefitsTable({ rules, current }: { rules: readonly TierRule[]; current: Tier }) {
  const rowFor = (label: string, value: (r: TierRule) => string) => ({ label, value });
  const rows = [
    rowFor("Active listings", (r) => (r.activeListingLimit === null ? "Unlimited" : String(r.activeListingLimit))),
    rowFor("Featured slots", (r) => String(r.featuredSlots)),
    rowFor("Analytics history", (r) => analyticsText(r.analyticsDays)),
    rowFor("Badge", (r) => (r.hasBadge ? "Yes" : "No")),
    rowFor("Ranking boost in directory and carousel", (r) => (r.rankingBoost > 0 ? `Yes (boost ${r.rankingBoost})` : "No")),
    rowFor("Unlock requirements", (r) => unlockText(r)),
    rowFor("Analytics CSV export", (r) => (canExportCsv(r.tier) ? "Yes" : "No")),
  ];
  return (
    <div className="relative overflow-x-auto rounded-lg border border-line bg-surface-raised">
      <table className="w-full text-left text-sm">
        <thead className="bg-surface text-xs uppercase tracking-wide text-ink-soft">
          <tr>
            <th scope="col" className="px-4 py-3">
              Benefit
            </th>
            {TIERS.map((t) => (
              <th key={t} scope="col" className="px-4 py-3">
                {tierName(t)}
                {t === current ? <span className="ml-2 normal-case text-brand-strong">(your tier)</span> : null}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-t border-line align-top">
              <th scope="row" className="px-4 py-3 font-medium text-ink">
                {row.label}
              </th>
              {TIERS.map((t) => {
                const rule = rules.find((r) => r.tier === t);
                return (
                  <td key={t} className="px-4 py-3 text-ink-soft">
                    {rule ? row.value(rule) : "Not set"}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
