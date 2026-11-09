import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AwaitingApprovalPage } from "@/components/seller/seller-pages";
import { ListingForm } from "@/components/seller/listing-form";
import { ListingMedia } from "@/components/seller/listing-media";
import { ListingDocuments } from "@/components/seller/listing-documents";
import { requireRole } from "@/lib/auth/require-role";
import { loadActiveCertificateLabs } from "@/lib/seller/labs";
import { gateApprovedSeller } from "@/lib/seller/approved-gate";
import { listingDefaults } from "@/lib/seller-catalogue/listing-form";
import { listingStatusLabels } from "@/lib/seller-catalogue/labels";
import { loadCategoryOptions, loadOwnedListingForEdit } from "@/lib/seller-catalogue/load";

type Params = Promise<{ id: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default function EditListingPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  return (
    <Suspense fallback={null}>
      <EditListingView params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function EditListingView({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const gate = await gateApprovedSeller();
  if (gate !== "approved") return <AwaitingApprovalPage title="Edit listing" />;

  const user = await requireRole(["SELLER"], { sellerApproved: true });
  const { id } = await params;
  const listing = await loadOwnedListingForEdit(user.id, id);
  // Another seller's id, or an unknown id, gets the same "not found" response.
  if (!listing) notFound();

  const [categories, labs, query] = await Promise.all([loadCategoryOptions(), loadActiveCertificateLabs(), searchParams]);
  const saved = query.saved === "submit" ? "submit" : query.saved === "draft" ? "draft" : undefined;

  return (
    <section className="mx-auto max-w-4xl space-y-12 px-4 py-10 sm:px-6">
      <header className="space-y-2">
        <p className="text-sm text-ink-soft">Status: {listingStatusLabels[listing.status] ?? listing.status}</p>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{listing.title}</h1>
        {listing.status === "REJECTED" && listing.rejectionReason ? (
          <p role="alert" className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
            Rejected: {listing.rejectionReason}
          </p>
        ) : null}
        {listing.status === "PUBLISHED" ? (
          <p className="text-sm text-ink-soft">Saving changes returns this listing to draft until it is submitted again.</p>
        ) : null}
      </header>

      <ListingForm
        listingId={listing.id}
        categories={categories}
        labs={labs}
        defaults={listingDefaults(listing)}
        savedNotice={saved}
      />

      <ListingMedia
        listingId={listing.id}
        media={listing.media.map((m) => ({
          id: m.id,
          type: m.type,
          sortOrder: m.sortOrder,
          isCover: m.isCover,
          status: m.status,
        }))}
      />

      <ListingDocuments listingId={listing.id} documents={listing.documents} labs={labs} />
    </section>
  );
}
