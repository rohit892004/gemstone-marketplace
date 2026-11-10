import { Suspense } from "react";
import { ListingForm } from "@/components/seller/listing-form";
import { AwaitingApprovalPage } from "@/components/seller/seller-pages";
import { PageHeader } from "@/components/ui/page-header";
import { loadActiveCertificateLabs } from "@/lib/seller/labs";
import { gateApprovedSeller } from "@/lib/seller/approved-gate";
import { loadCategoryOptions } from "@/lib/seller-catalogue/load";

export default function NewListingPage() {
  return (
    <Suspense fallback={null}>
      <NewListingView />
    </Suspense>
  );
}

async function NewListingView() {
  const gate = await gateApprovedSeller();
  if (gate !== "approved") return <AwaitingApprovalPage title="New listing" />;

  const [categories, labs] = await Promise.all([loadCategoryOptions(), loadActiveCertificateLabs()]);

  return (
    <div className="max-w-4xl space-y-10">
      <PageHeader
        eyebrow="Catalogue"
        title="New listing"
        lead="Saving a draft keeps it private. Submit it for review when it is ready. You can add photos and documents after the first save."
      />
      <ListingForm categories={categories} labs={labs} defaults={{}} />
    </div>
  );
}
