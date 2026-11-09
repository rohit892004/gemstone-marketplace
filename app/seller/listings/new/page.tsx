import { Suspense } from "react";
import { ListingForm } from "@/components/seller/listing-form";
import { AwaitingApprovalPage } from "@/components/seller/seller-pages";
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
    <section className="mx-auto max-w-4xl space-y-8 px-4 py-10 sm:px-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">New listing</h1>
        <p className="text-sm text-ink-soft">
          Saving a draft keeps it private. Submit it for review when it is ready. You can add photos and documents after the first save.
        </p>
      </header>
      <ListingForm categories={categories} labs={labs} defaults={{}} />
    </section>
  );
}
