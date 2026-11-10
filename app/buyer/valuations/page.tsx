import { Suspense } from "react";
import { StartValuationButton } from "@/components/valuation/start-valuation-button";
import { ValuationList } from "@/components/valuation/requester-lists";
import { listRequesterValuations } from "@/lib/valuation/requester-queries";
import { requireBuyerPage } from "../guard";
import { EmptyValuations } from "@/components/valuation/empty-states";

export default function ValuationsPage() {
  return (
    <Suspense fallback={null}>
      <Valuations />
    </Suspense>
  );
}

async function Valuations() {
  const user = await requireBuyerPage();
  const rows = await listRequesterValuations(user.id);
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-ink-soft">Your valuation requests and where each one stands. Open a request to see its result.</p>
        <StartValuationButton />
      </div>
      <ValuationList rows={rows} resultsHref="/valuation" empty={<EmptyValuations />} />
    </div>
  );
}
