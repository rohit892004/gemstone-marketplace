import { redirect } from "next/navigation";
import { Suspense } from "react";
import { BuyingSideTabs } from "@/components/valuation/buying-side-tabs";
import { EmptyValuations } from "@/components/valuation/empty-states";
import { RequesterAccessMessage } from "@/components/valuation/requester-access";
import { StartValuationButton } from "@/components/valuation/start-valuation-button";
import { ValuationList } from "@/components/valuation/requester-lists";
import { sellerBuyingGate } from "@/app/valuation/guard";
import { listRequesterValuations } from "@/lib/valuation/requester-queries";
import { REQUESTER_PATHS } from "@/lib/valuation/requester-paths";

export default function SellerValuationsPage() {
  return (
    <Suspense fallback={null}>
      <Valuations />
    </Suspense>
  );
}

async function Valuations() {
  const gate = await sellerBuyingGate();
  if (gate.kind === "other") redirect("/dashboard");
  if (gate.kind === "message") {
    return (
      <>
        <BuyingSideTabs current="valuations" />
        <div className="mt-8">
          <RequesterAccessMessage state={gate.state} returnTo={REQUESTER_PATHS.sellerValuations} title="Valuations" />
        </div>
      </>
    );
  }
  const rows = await listRequesterValuations(gate.userId);
  return (
    <>
      <BuyingSideTabs current="valuations" />
      <div className="mt-8 space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-ink-soft">
            Valuations you requested, including for your own listings. A report on your own listing reaches buyers only if you publish it there.
          </p>
          <StartValuationButton />
        </div>
        <ValuationList rows={rows} resultsHref="/valuation" empty={<EmptyValuations />} />
      </div>
    </>
  );
}
