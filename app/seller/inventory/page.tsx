import { Suspense } from "react";
import { AwaitingApprovalPage, ComingLaterPage } from "@/components/seller/seller-pages";
import { gateApprovedSeller } from "@/lib/seller/approved-gate";

export default function SellerInventoryPage() {
  return (
    <Suspense fallback={null}>
      <SellerInventoryGate />
    </Suspense>
  );
}

async function SellerInventoryGate() {
  const state = await gateApprovedSeller();
  return state === "approved" ? <ComingLaterPage title="Inventory" /> : <AwaitingApprovalPage title="Inventory" />;
}
