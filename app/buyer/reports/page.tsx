import { Suspense } from "react";
import { SavedReportList } from "@/components/valuation/requester-lists";
import { EmptyReports } from "@/components/valuation/empty-states";
import { listSavedReports } from "@/lib/valuation/requester-queries";
import { requireBuyerPage } from "../guard";

export default function ReportsPage() {
  return (
    <Suspense fallback={null}>
      <Reports />
    </Suspense>
  );
}

async function Reports() {
  const user = await requireBuyerPage();
  const rows = await listSavedReports(user.id);
  return (
    <div className="space-y-6">
      <p className="text-sm text-ink-soft">Completed valuation reports, with their PDF. A withdrawn report stays here, marked as withdrawn.</p>
      <SavedReportList rows={rows} resultsHref="/valuation" empty={<EmptyReports />} />
    </div>
  );
}
