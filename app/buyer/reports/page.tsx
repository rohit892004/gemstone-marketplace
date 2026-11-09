import { Suspense } from "react";
import { ComingSoon } from "../coming-soon";
import { requireBuyerPage } from "../guard";

export default function ReportsPage() {
  return (
    <Suspense fallback={null}>
      <Reports />
    </Suspense>
  );
}

async function Reports() {
  await requireBuyerPage();
  return <ComingSoon title="Saved reports" empty="No saved reports yet" />;
}
