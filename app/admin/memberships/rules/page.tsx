import { Suspense } from "react";
import { RulesForm } from "@/components/membership/admin-forms";
import { PageHeader } from "@/components/ui/page-header";
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
    <div className="space-y-10">
      <PageHeader
        eyebrow="Memberships"
        title="Tier rules"
        lead="Leave a listing limit blank for unlimited. Unlock values apply to Premium and Elite only; Free has none. A seller unlocks a tier with enough referrals or followers (either one), plus the response rate and any minimum rating."
      />
      <p className="border-l-2 border-accent bg-accent-soft/50 px-5 py-4 text-sm leading-relaxed text-ink">
        Placeholder rules, pending client confirmation. {PENDING_CONFIRMATION}.
      </p>
      <RulesForm rules={rules} />
    </div>
  );
}
