import { redirect } from "next/navigation";
import { Suspense } from "react";
import { BuyingSideTabs } from "@/components/valuation/buying-side-tabs";
import { EmptyReports } from "@/components/valuation/empty-states";
import { RequesterAccessMessage } from "@/components/valuation/requester-access";
import { SavedReportList } from "@/components/valuation/requester-lists";
import { sellerBuyingGate } from "@/app/valuation/guard";
import { listSavedReports } from "@/lib/valuation/requester-queries";
import { REQUESTER_PATHS } from "@/lib/valuation/requester-paths";

export default function SellerReportsPage() {
  return (
    <Suspense fallback={null}>
      <Reports />
    </Suspense>
  );
}

async function Reports() {
  const gate = await sellerBuyingGate();
  if (gate.kind === "other") redirect("/dashboard");
  if (gate.kind === "message") {
    return (
      <>
        <BuyingSideTabs current="reports" />
        <div className="mt-8">
          <RequesterAccessMessage state={gate.state} returnTo={REQUESTER_PATHS.sellerReports} title="Saved reports" />
        </div>
      </>
    );
  }
  const rows = await listSavedReports(gate.userId);
  return (
    <>
      <BuyingSideTabs current="reports" />
      <div className="mt-8 space-y-6">
        <p className="text-sm text-ink-soft">Completed valuation reports you requested as a buyer, with their PDF. A withdrawn report stays here, marked as withdrawn.</p>
        <SavedReportList rows={rows} resultsHref="/valuation" empty={<EmptyReports />} />
      </div>
    </>
  );
}
