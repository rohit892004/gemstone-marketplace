import { Suspense } from "react";
import { AwaitingApprovalPage, ComingLaterPage } from "@/components/seller/seller-pages";
import { gateApprovedSeller } from "@/lib/seller/approved-gate";

export default function SellerListingsPage() {
  return (
    <Suspense fallback={null}>
      <SellerListingsGate />
    </Suspense>
  );
}

async function SellerListingsGate() {
  const state = await gateApprovedSeller();
  return state === "approved" ? <ComingLaterPage title="Listings" /> : <AwaitingApprovalPage title="Listings" />;
}
