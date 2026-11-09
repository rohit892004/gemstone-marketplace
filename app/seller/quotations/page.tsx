import { Suspense } from "react";
import { AwaitingApprovalPage, ComingLaterPage } from "@/components/seller/seller-pages";
import { gateApprovedSeller } from "@/lib/seller/approved-gate";

export default function SellerQuotationsPage() {
  return (
    <Suspense fallback={null}>
      <SellerQuotationsGate />
    </Suspense>
  );
}

async function SellerQuotationsGate() {
  const state = await gateApprovedSeller();
  return state === "approved" ? <ComingLaterPage title="Quotations" /> : <AwaitingApprovalPage title="Quotations" />;
}
