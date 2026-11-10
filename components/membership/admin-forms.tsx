"use client";

import { useActionState, useId } from "react";
import { clearTierOverrideAction, saveTierRulesAction, setTierOverrideAction } from "@/app/admin/memberships/actions";
import { clearReferralFlagAction, voidReferralAction } from "@/app/admin/referrals/actions";
import type { AdminActionState } from "@/lib/admin/action-state";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { DataTable, type Column } from "@/components/ui/data-table";
import { TIERS, type Tier, type TierRule } from "@/lib/membership/tiers";


function Result({ state }: { state: AdminActionState }) {
  if (!state) return null;
  return state.ok ? (
    <p role="status" className="text-sm text-success">
      {state.message}
    </p>
  ) : (
    <p role="alert" className="text-sm text-danger">
      {state.error}
    </p>
  );
}

const TIER_LABEL: Record<Tier, string> = { FREE: "Free", PREMIUM: "Premium", ELITE: "Elite" };

/** Manual tier override for one seller. The reason is required and audited. */
export function TierOverrideForm({ sellerId, currentTier }: { sellerId: string; currentTier: Tier }) {
  const [state, action, pending] = useActionState(setTierOverrideAction, null);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="sellerId" value={sellerId} />
      <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
        <Field id={`tier-${sellerId}`} label="Set tier">
          <Select id={`tier-${sellerId}`} name="tier" defaultValue={currentTier}>
            {TIERS.map((t) => (
              <option key={t} value={t}>
                {TIER_LABEL[t]}
              </option>
            ))}
          </Select>
        </Field>
        <Field id={`reason-${sellerId}`} label="Reason (required, at least 5 characters)">
          <Input id={`reason-${sellerId}`} name="reason" type="text" maxLength={500} required />
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          Set tier
        </Button>
      </div>
      <Result state={state} />
    </form>
  );
}

export function ClearOverrideForm({ sellerId }: { sellerId: string }) {
  const [state, action, pending] = useActionState(clearTierOverrideAction, null);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="sellerId" value={sellerId} />
      <Button type="submit" disabled={pending} variant="secondary">
        Clear override
      </Button>
      <Result state={state} />
    </form>
  );
}

/** The tier rules table: one row per tier, every rule field as a labelled input. */
export function RulesForm({ rules }: { rules: readonly TierRule[] }) {
  const [state, action, pending] = useActionState(saveTierRulesAction, null);
  const byTier = new Map(rules.map((r) => [r.tier, r]));
  const uid = useId();

  const numberInput = (tier: Tier, name: string, value: number | null | undefined, extra?: { step?: string; min?: number }) => (
    <>
      <label htmlFor={`${uid}-${tier}-${name}`} className="sr-only">
        {`${TIER_LABEL[tier]} ${COLUMN_LABEL[name] ?? name}`}
      </label>
      <div className="w-24">
        <Input
          id={`${uid}-${tier}-${name}`}
          name={`${tier}.${name}`}
          type="number"
          inputMode="decimal"
          step={extra?.step ?? "1"}
          min={extra?.min ?? 0}
          defaultValue={value ?? ""}
        />
      </div>
    </>
  );

  const checkboxInput = (tier: Tier, name: string, checked: boolean) => (
    <>
      <label htmlFor={`${uid}-${tier}-${name}`} className="sr-only">
        {`${TIER_LABEL[tier]} ${COLUMN_LABEL[name] ?? name}`}
      </label>
      <input id={`${uid}-${tier}-${name}`} name={`${tier}.${name}`} type="checkbox" defaultChecked={checked} className="h-5 w-5 accent-brand" />
    </>
  );

  const COLUMN_LABEL: Record<string, string> = {
    activeListingLimit: "listing limit",
    featuredSlots: "featured slots",
    analyticsDays: "analytics days",
    hasBadge: "badge",
    rankingBoost: "ranking boost",
    unlockReferrals: "referrals to unlock",
    unlockFollowers: "followers to unlock",
    minResponseRate: "minimum response rate",
    minRating: "minimum rating",
  };

  const columns: Column<Tier>[] = [
    { key: "tier", header: "Tier", cell: (tier) => <span className="font-heading text-lg text-ink">{TIER_LABEL[tier]}</span> },
    { key: "activeListingLimit", header: "Listing limit (blank = unlimited)", cell: (tier) => numberInput(tier, "activeListingLimit", byTier.get(tier)?.activeListingLimit) },
    { key: "featuredSlots", header: "Featured slots", cell: (tier) => numberInput(tier, "featuredSlots", byTier.get(tier)?.featuredSlots) },
    { key: "analyticsDays", header: "Analytics days", cell: (tier) => numberInput(tier, "analyticsDays", byTier.get(tier)?.analyticsDays) },
    { key: "hasBadge", header: "Badge", cell: (tier) => checkboxInput(tier, "hasBadge", byTier.get(tier)?.hasBadge ?? false) },
    { key: "rankingBoost", header: "Ranking boost", cell: (tier) => numberInput(tier, "rankingBoost", byTier.get(tier)?.rankingBoost) },
    { key: "unlockReferrals", header: "Referrals to unlock", cell: (tier) => numberInput(tier, "unlockReferrals", byTier.get(tier)?.unlockReferrals) },
    { key: "unlockFollowers", header: "Followers to unlock", cell: (tier) => numberInput(tier, "unlockFollowers", byTier.get(tier)?.unlockFollowers) },
    {
      key: "minResponseRate",
      header: "Min response rate (%)",
      cell: (tier) => numberInput(tier, "minResponseRate", byTier.get(tier)?.minResponseRate, { min: 0 }),
    },
    {
      key: "minRating",
      header: "Min rating (blank = none)",
      cell: (tier) => numberInput(tier, "minRating", byTier.get(tier)?.minRating, { step: "0.01", min: 0 }),
    },
  ];

  return (
    <form action={action} className="space-y-6">
      <DataTable caption="Tier rules" columns={columns} rows={[...TIERS]} getRowKey={(tier) => tier} />
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          Save tier rules
        </Button>
      </div>
      <Result state={state} />
    </form>
  );
}

export function VoidReferralForm({ referralId }: { referralId: string }) {
  const [state, action, pending] = useActionState(voidReferralAction, null);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="referralId" value={referralId} />
      <div className="space-y-2">
        <Field id={`void-${referralId}`} label="Reason for voiding (required)">
          <Input id={`void-${referralId}`} name="reason" type="text" maxLength={500} required />
        </Field>
      </div>
      <Button type="submit" disabled={pending} variant="secondary">
        Void referral
      </Button>
      <Result state={state} />
    </form>
  );
}

export function ClearFlagForm({ referralId }: { referralId: string }) {
  const [state, action, pending] = useActionState(clearReferralFlagAction, null);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="referralId" value={referralId} />
      <Button type="submit" disabled={pending}>
        Clear flag
      </Button>
      <Result state={state} />
    </form>
  );
}

