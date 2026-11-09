import { Suspense } from "react";
import { AwaitingApprovalPage, ComingLaterPage } from "@/components/seller/seller-pages";
import { gateApprovedSeller } from "@/lib/seller/approved-gate";

export default function SellerEnquiriesPage() {
  return (
    <Suspense fallback={null}>
      <SellerEnquiriesGate />
    </Suspense>
  );
}

async function SellerEnquiriesGate() {
  const state = await gateApprovedSeller();
  return state === "approved" ? <ComingLaterPage title="Enquiries" /> : <AwaitingApprovalPage title="Enquiries" />;
}
