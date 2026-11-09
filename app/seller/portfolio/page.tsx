import { Suspense } from "react";
import { AwaitingApprovalPage, ComingLaterPage } from "@/components/seller/seller-pages";
import { gateApprovedSeller } from "@/lib/seller/approved-gate";

export default function SellerPortfolioPage() {
  return (
    <Suspense fallback={null}>
      <SellerPortfolioGate />
    </Suspense>
  );
}

async function SellerPortfolioGate() {
  const state = await gateApprovedSeller();
  return state === "approved" ? <ComingLaterPage title="Portfolio" /> : <AwaitingApprovalPage title="Portfolio" />;
}
