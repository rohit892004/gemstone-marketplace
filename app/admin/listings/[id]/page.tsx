import Image from "next/image";
import { FileText, ImageOff } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { ArrowLeft, Download } from "lucide-react";
import { ActionForm } from "@/components/admin/action-form";
import { AdminDemoTag, formatBytes, formatDate } from "@/components/admin/admin-ui";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageHeader, SectionHeading } from "@/components/ui/page-header";
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
    <div className="space-y-1">
      <dt className="text-[11px] uppercase tracking-[0.18em] text-ink-soft">{label}</dt>
      <dd className="text-[15px] text-ink">{value || "-"}</dd>
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
  const statusWord = listing.status.replace(/_/g, " ").toLowerCase();

  return (
    <div className="space-y-12">
      <Link href="/admin/listings" className="inline-flex min-h-11 items-center gap-2 text-sm text-ink-soft underline underline-offset-4 hover:text-ink">
        <ArrowLeft className="h-4 w-4" strokeWidth={1.25} aria-hidden />
        Back to review queue
      </Link>

      <PageHeader
        eyebrow="Listing review"
        title={listing.title}
        lead={
          <span className="flex flex-wrap items-center gap-3">
            <Badge tone={pending ? "warning" : listing.status === "PUBLISHED" ? "success" : "neutral"}>Status: {statusWord}</Badge>
            {listing.isDemo ? <AdminDemoTag /> : null}
            {listing.status === "PUBLISHED" ? (
              <Link href={`/gemstones/${listing.slug}`} className="text-sm text-ink underline underline-offset-4 hover:text-accent-text">
                Open the public page
              </Link>
            ) : (
              <span className="text-sm text-ink-soft">Not public until published</span>
            )}
          </span>
        }
      />

      {listing.rejectionReason ? (
        <p className="border-l-2 border-danger bg-surface-raised px-5 py-4 text-sm leading-relaxed text-ink">
          Last rejection reason: {listing.rejectionReason}
        </p>
      ) : null}

      <section className="space-y-6">
        <SectionHeading title="Decision" />
        {pending ? (
          <div className="grid gap-6 md:grid-cols-2">
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
          <p className="text-[15px] text-ink-soft">
            This listing is {statusWord}. Decisions apply only to listings waiting for review.
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

      <section className="space-y-6">
        <SectionHeading title="Media" />
        {listing.media.length === 0 ? (
          <EmptyState icon={ImageOff} title="No media uploaded" body="The seller has not added any photos or video to this listing." />
        ) : (
          <ul className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {listing.media.map((m) => (
              <li key={m.id} className="space-y-2">
                {m.type === "IMAGE" && m.status === "READY" ? (
                  <div className="relative aspect-[4/3] overflow-hidden border border-line bg-panel">
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
                  <p className="text-sm text-ink-soft">
                    {m.type.toLowerCase()} ({m.status.toLowerCase()})
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-6">
        <SectionHeading title="Details" />
        <Card className="p-5 sm:p-8">
          <dl className="grid gap-6 md:grid-cols-3">
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
            <Field label="Price" value={listing.priceOnRequest ? "On request" : formatMoney(listing.priceMinor, listing.currency)} />
            <Field label="Availability" value={listing.availability.toLowerCase()} />
            <Field label="Featured" value={listing.featured ? "Yes" : "No"} />
          </dl>
        </Card>
        {listing.description ? (
          <p className="whitespace-pre-line border border-line bg-surface-raised p-5 text-[15px] leading-relaxed text-ink">{listing.description}</p>
        ) : null}
      </section>

      <section className="space-y-6">
        <SectionHeading title="Documents" />
        {listing.documents.length === 0 ? (
          <EmptyState icon={FileText} title="No documents attached" body="The seller has not attached any documents to this listing." />
        ) : (
          <ul className="space-y-3">
            {listing.documents.map((doc) => (
              <li key={doc.id} className="flex flex-wrap items-center gap-3 border border-line bg-surface-raised p-4 text-sm">
                <span className="font-medium text-ink">{doc.title}</span>
                {doc.verificationStatus === "VERIFIED" ? <Badge tone="verified">Verified</Badge> : null}
                <span className="text-ink-soft">
                  {doc.verificationStatus.toLowerCase()} · {doc.isPublic ? "shown publicly" : "private"} · {formatBytes(doc.sizeBytes)}
                </span>
                <a
                  href={listingDocumentUrl(doc.id)}
                  className="inline-flex min-h-11 items-center gap-2 text-ink underline underline-offset-4 hover:text-accent-text"
                >
                  <Download className="h-4 w-4" strokeWidth={1.25} aria-hidden />
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
