import { Suspense } from "react";
import { RulesForm } from "@/components/membership/admin-forms";
import { requirePageRole } from "@/lib/auth/require-role";
import { loadTierRules } from "@/lib/membership/service";
import { PENDING_CONFIRMATION } from "@/lib/membership/defaults";

/** Tier rules editor. One row per tier. Saving validates on the server and reports the first problem as text. */
export default function TierRulesPage() {
  return (
    <Suspense fallback={null}>
      <RulesView />
    </Suspense>
  );
}

async function RulesView() {
  await requirePageRole(["ADMIN"]);
  const rules = await loadTierRules();
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Tier rules</h1>
        <p className="rounded border border-amber-700 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Placeholder rules, pending client confirmation. {PENDING_CONFIRMATION}.
        </p>
        <p className="text-sm text-stone-600">
          Leave a listing limit blank for unlimited. Unlock values apply to Premium and Elite only; Free has none.
          A seller unlocks a tier with enough referrals or followers (either one), plus the response rate and any minimum rating.
        </p>
      </div>
      <RulesForm rules={rules} />
    </div>
  );
}
