import { Suspense } from "react";
import { ComingSoon } from "../coming-soon";
import { requireBuyerPage } from "../guard";

export default function ValuationsPage() {
  return (
    <Suspense fallback={null}>
      <Valuations />
    </Suspense>
  );
}

async function Valuations() {
  await requireBuyerPage();
  return <ComingSoon title="Valuations" empty="No valuation requests yet" />;
}
