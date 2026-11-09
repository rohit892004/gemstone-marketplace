import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { ActionForm } from "@/components/admin/action-form";
import { formatBytes, formatDate } from "@/components/admin/admin-ui";
import { DemoBadge, VerifiedBadge } from "@/components/catalogue/badges";
import { requirePageRole } from "@/lib/auth/require-role";
import { prisma } from "@/lib/db/client";
import { listingDocumentUrl, mediaUrl } from "@/lib/media/urls";
import { formatMoney } from "@/lib/money/money";
import { approveListing, rejectListing, setListingFeatured } from "../actions";

/**
 * Admin preview. Shows the full listing with media and documents REGARDLESS of its status, so
 * reviewers see exactly what a buyer would see once it is published.
 */

export const metadata = { title: "Review listing", robots: { index: false, follow: false } };

type Params = Promise<{ id: string }>;

export default function AdminListingPreviewPage({ params }: { params: Params }) {
  return (
    <Suspense fallback={null}>
      <Preview params={params} />
    </Suspense>
  );
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-stone-600">{label}</dt>
      <dd className="text-sm">{value || "-"}</dd>
    </div>
  );
}

async function Preview({ params }: { params: Params }) {
  await requirePageRole(["ADMIN"]);
  const { id } = await params;

  const listing = await prisma.gemstone.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      slug: true,
      status: true,
      availability: true,
      featured: true,
      isDemo: true,
      description: true,
      species: true,
      variety: true,
      shape: true,
      cut: true,
      caratWeight: true,
      dimensions: true,
      colour: true,
      clarity: true,
      origin: true,
      treatment: true,
      certificateNo: true,
      quantity: true,
      priceMinor: true,
      priceOnRequest: true,
      currency: true,
      submittedAt: true,
      publishedAt: true,
      rejectionReason: true,
      seller: { select: { businessName: true, city: true, state: true, approvalStatus: true } },
      certificateLab: { select: { name: true } },
      media: {
        orderBy: [{ isCover: "desc" }, { sortOrder: "asc" }],
        select: { id: true, type: true, status: true, alt: true },
      },
      documents: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          title: true,
          type: true,
          fileName: true,
          sizeBytes: true,
          isPublic: true,
          verificationStatus: true,
          verificationReason: true,
        },
      },
    },
  });
  if (!listing) notFound();

  const pending = listing.status === "PENDING_REVIEW";

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Link href="/admin/listings" className="underline">
          Back to review queue
        </Link>
        <span className="text-stone-400">|</span>
        <span>Status: {listing.status.replace(/_/g, " ").toLowerCase()}</span>
        <span className="text-stone-400">|</span>
        <span>Public page: {listing.status === "PUBLISHED" ? <Link href={`/gemstones/${listing.slug}`} className="underline">open</Link> : "not public until published"}</span>
      </div>

      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">{listing.title}</h1>
        {listing.isDemo ? <DemoBadge /> : null}
      </header>

      {listing.rejectionReason ? (
        <p className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-900">
          Last rejection reason: {listing.rejectionReason}
        </p>
      ) : null}

      <section aria-labelledby="decision-heading" className="space-y-4">
        <h2 id="decision-heading" className="text-lg font-semibold">
          Decision
        </h2>
        {pending ? (
          <div className="grid gap-4 md:grid-cols-2">
            <ActionForm
              action={approveListing}
              hidden={{ listingId: listing.id }}
              title="Approve and publish"
              description="The listing goes live and the seller is emailed."
              submitLabel="Approve listing"
            />
            <ActionForm
              action={rejectListing}
              hidden={{ listingId: listing.id }}
              title="Reject listing"
              description="The seller is emailed the reason and can edit and resubmit."
              submitLabel="Reject listing"
              tone="danger"
              fields={[
                {
                  name: "reason",
                  label: "Reason for rejection (at least 10 characters)",
                  kind: "textarea",
                  required: true,
                  maxLength: 1000,
                },
              ]}
            />
          </div>
        ) : (
          <p className="text-sm text-stone-600">
            This listing is {listing.status.replace(/_/g, " ").toLowerCase()}. Decisions apply only to listings waiting for review.
          </p>
        )}
        {listing.status === "PUBLISHED" ? (
          <ActionForm
            action={setListingFeatured}
            hidden={{ listingId: listing.id, featured: String(!listing.featured) }}
            title={listing.featured ? "Remove from featured" : "Feature this listing"}
            description="Featured listings appear in the homepage carousel when public."
            submitLabel={listing.featured ? "Unfeature" : "Feature"}
          />
        ) : null}
      </section>

      <section aria-labelledby="media-heading" className="space-y-3">
        <h2 id="media-heading" className="text-lg font-semibold">
          Media
        </h2>
        {listing.media.length === 0 ? (
          <p className="text-sm text-stone-600">No media uploaded.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {listing.media.map((m) => (
              <li key={m.id} className="space-y-1">
                {m.type === "IMAGE" && m.status === "READY" ? (
                  <div className="relative aspect-[4/3] overflow-hidden rounded border border-stone-300 bg-stone-100">
                    <Image
                      src={mediaUrl(m.id, "thumb")}
                      alt={m.alt ?? listing.title}
                      fill
                      sizes="25vw"
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                ) : (
                  <p className="text-sm text-stone-600">
                    {m.type.toLowerCase()} ({m.status.toLowerCase()})
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="details-heading" className="space-y-3">
        <h2 id="details-heading" className="text-lg font-semibold">
          Details
        </h2>
        <dl className="grid gap-4 rounded border border-stone-300 bg-white p-4 md:grid-cols-3">
          <Field label="Seller" value={`${listing.seller.businessName} (${listing.seller.approvalStatus.toLowerCase()})`} />
          <Field label="Location" value={`${listing.seller.city}, ${listing.seller.state}`} />
          <Field label="Submitted" value={formatDate(listing.submittedAt)} />
          <Field label="Published" value={formatDate(listing.publishedAt)} />
          <Field label="Type" value={listing.species} />
          <Field label="Variety" value={listing.variety} />
          <Field label="Shape" value={listing.shape} />
          <Field label="Cut" value={listing.cut} />
          <Field label="Carat" value={listing.caratWeight ? `${listing.caratWeight.toString()} ct` : null} />
          <Field label="Dimensions" value={listing.dimensions} />
          <Field label="Colour" value={listing.colour} />
          <Field label="Clarity" value={listing.clarity} />
          <Field label="Origin" value={listing.origin} />
          <Field label="Treatment" value={listing.treatment} />
          <Field label="Certificate lab" value={listing.certificateLab?.name} />
          <Field label="Certificate no." value={listing.certificateNo} />
          <Field label="Quantity" value={listing.quantity} />
          <Field
            label="Price"
            value={listing.priceOnRequest ? "On request" : formatMoney(listing.priceMinor, listing.currency)}
          />
          <Field label="Availability" value={listing.availability.toLowerCase()} />
          <Field label="Featured" value={listing.featured ? "Yes" : "No"} />
        </dl>
        {listing.description ? (
          <p className="whitespace-pre-line rounded border border-stone-300 bg-white p-4 text-sm">{listing.description}</p>
        ) : null}
      </section>

      <section aria-labelledby="docs-heading" className="space-y-3">
        <h2 id="docs-heading" className="text-lg font-semibold">
          Documents
        </h2>
        {listing.documents.length === 0 ? (
          <p className="text-sm text-stone-600">No documents attached.</p>
        ) : (
          <ul className="space-y-2">
            {listing.documents.map((doc) => (
              <li key={doc.id} className="flex flex-wrap items-center gap-3 rounded border border-stone-300 bg-white p-3 text-sm">
                <span className="font-medium">{doc.title}</span>
                {doc.verificationStatus === "VERIFIED" ? <VerifiedBadge /> : null}
                <span className="text-stone-600">
                  {doc.verificationStatus.toLowerCase()} · {doc.isPublic ? "shown publicly" : "private"} · {formatBytes(doc.sizeBytes)}
                </span>
                <a href={listingDocumentUrl(doc.id)} className="underline">
                  Download {doc.fileName}
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
