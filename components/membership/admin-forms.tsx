"use client";

import { useActionState, type ReactNode } from "react";
import { clearTierOverrideAction, saveTierRulesAction, setTierOverrideAction } from "@/app/admin/memberships/actions";
import { clearReferralFlagAction, voidReferralAction } from "@/app/admin/referrals/actions";
import type { AdminActionState } from "@/lib/admin/action-state";
import { TIERS, type Tier, type TierRule } from "@/lib/membership/tiers";

const inputClass = "mt-1 w-full rounded-md border border-line bg-surface-raised px-2 py-1.5 text-sm text-ink";
const buttonClass = "rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60";
const secondaryButtonClass = "rounded-md border border-line px-3 py-1.5 text-sm font-medium text-ink disabled:opacity-60";

function Result({ state }: { state: AdminActionState }) {
  if (!state) return null;
  return state.ok ? (
    <p role="status" className="text-sm text-ink">
      {state.message}
    </p>
  ) : (
    <p role="alert" className="text-sm text-red-700">
      {state.error}
    </p>
  );
}

const TIER_LABEL: Record<Tier, string> = { FREE: "Free", PREMIUM: "Premium", ELITE: "Elite" };

/** Manual tier override for one seller. The reason is required and audited. */
export function TierOverrideForm({ sellerId, currentTier }: { sellerId: string; currentTier: Tier }) {
  const [state, action, pending] = useActionState(setTierOverrideAction, null);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="sellerId" value={sellerId} />
      <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
        <div>
          <label htmlFor={`tier-${sellerId}`} className="block text-sm font-medium text-ink">
            Set tier
          </label>
          <select id={`tier-${sellerId}`} name="tier" defaultValue={currentTier} className={inputClass}>
            {TIERS.map((t) => (
              <option key={t} value={t}>
                {TIER_LABEL[t]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`reason-${sellerId}`} className="block text-sm font-medium text-ink">
            Reason (required, at least 5 characters)
          </label>
          <input id={`reason-${sellerId}`} name="reason" type="text" maxLength={500} required className={inputClass} />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={buttonClass}>
          Set tier
        </button>
      </div>
      <Result state={state} />
    </form>
  );
}

export function ClearOverrideForm({ sellerId }: { sellerId: string }) {
  const [state, action, pending] = useActionState(clearTierOverrideAction, null);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="sellerId" value={sellerId} />
      <button type="submit" disabled={pending} className={secondaryButtonClass}>
        Clear override
      </button>
      <Result state={state} />
    </form>
  );
}

/** The tier rules table: one row per tier, every rule field as a labelled input. */
export function RulesForm({ rules }: { rules: readonly TierRule[] }) {
  const [state, action, pending] = useActionState(saveTierRulesAction, null);
  const byTier = new Map(rules.map((r) => [r.tier, r]));
  const cell = (tier: Tier, name: string, label: string, input: ReactNode) => (
    <td className="px-3 py-2 align-top">
      <label htmlFor={`${tier}-${name}`} className="sr-only">
        {`${TIER_LABEL[tier]} ${label}`}
      </label>
      {input}
    </td>
  );
  const numberInput = (tier: Tier, name: string, value: number | null | undefined, extra?: { step?: string; min?: number }) => (
    <input
      id={`${tier}-${name}`}
      name={`${tier}.${name}`}
      type="number"
      inputMode="decimal"
      step={extra?.step ?? "1"}
      min={extra?.min ?? 0}
      defaultValue={value ?? ""}
      className={inputClass + " w-24"}
    />
  );

  const headers: { key: string; label: string }[] = [
    { key: "tier", label: "Tier" },
    { key: "activeListingLimit", label: "Listing limit (blank = unlimited)" },
    { key: "featuredSlots", label: "Featured slots" },
    { key: "analyticsDays", label: "Analytics days" },
    { key: "hasBadge", label: "Badge" },
    { key: "rankingBoost", label: "Ranking boost" },
    { key: "unlockReferrals", label: "Referrals to unlock" },
    { key: "unlockFollowers", label: "Followers to unlock" },
    { key: "minResponseRate", label: "Min response rate (%)" },
    { key: "minRating", label: "Min rating (blank = none)" },
  ];

  return (
    <form action={action} className="space-y-4">
      <div className="relative overflow-x-auto rounded border border-stone-300 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-stone-100 text-xs uppercase tracking-wide text-stone-600">
            <tr>
              {headers.map((h) => (
                <th key={h.key} scope="col" className="whitespace-nowrap px-3 py-2">
                  {h.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {TIERS.map((tier) => {
              const r = byTier.get(tier);
              return (
                <tr key={tier} className="border-t border-stone-200">
                  <th scope="row" className="whitespace-nowrap px-3 py-2 font-medium">
                    {TIER_LABEL[tier]}
                  </th>
                  {cell(tier, "activeListingLimit", "listing limit", numberInput(tier, "activeListingLimit", r?.activeListingLimit))}
                  {cell(tier, "featuredSlots", "featured slots", numberInput(tier, "featuredSlots", r?.featuredSlots))}
                  {cell(tier, "analyticsDays", "analytics days", numberInput(tier, "analyticsDays", r?.analyticsDays))}
                  {cell(
                    tier,
                    "hasBadge",
                    "badge",
                    <input id={`${tier}-hasBadge`} name={`${tier}.hasBadge`} type="checkbox" defaultChecked={r?.hasBadge ?? false} className="size-4" />,
                  )}
                  {cell(tier, "rankingBoost", "ranking boost", numberInput(tier, "rankingBoost", r?.rankingBoost))}
                  {cell(tier, "unlockReferrals", "referrals to unlock", numberInput(tier, "unlockReferrals", r?.unlockReferrals))}
                  {cell(tier, "unlockFollowers", "followers to unlock", numberInput(tier, "unlockFollowers", r?.unlockFollowers))}
                  {cell(tier, "minResponseRate", "minimum response rate", numberInput(tier, "minResponseRate", r?.minResponseRate, { min: 0 }))}
                  {cell(tier, "minRating", "minimum rating", numberInput(tier, "minRating", r?.minRating, { step: "0.01", min: 0 }))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={buttonClass}>
          Save tier rules
        </button>
      </div>
      <Result state={state} />
    </form>
  );
}

export function VoidReferralForm({ referralId }: { referralId: string }) {
  const [state, action, pending] = useActionState(voidReferralAction, null);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="referralId" value={referralId} />
      <div>
        <label htmlFor={`void-${referralId}`} className="block text-sm font-medium text-ink">
          Reason for voiding (required)
        </label>
        <input id={`void-${referralId}`} name="reason" type="text" maxLength={500} required className={inputClass} />
      </div>
      <button type="submit" disabled={pending} className={secondaryButtonClass}>
        Void referral
      </button>
      <Result state={state} />
    </form>
  );
}

export function ClearFlagForm({ referralId }: { referralId: string }) {
  const [state, action, pending] = useActionState(clearReferralFlagAction, null);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="referralId" value={referralId} />
      <button type="submit" disabled={pending} className={buttonClass}>
        Clear flag
      </button>
      <Result state={state} />
    </form>
  );
}
