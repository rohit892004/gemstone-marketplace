import Link from "next/link";
import { Suspense } from "react";
import { ClipboardCheck } from "lucide-react";
import { AdminDemoTag, formatDate } from "@/components/admin/admin-ui";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requirePageRole } from "@/lib/auth/require-role";
import { prisma } from "@/lib/db/client";
import { formatMoney } from "@/lib/money/money";

export const metadata = { title: "Listing review queue", robots: { index: false, follow: false } };

export default function AdminListingQueuePage() {
  return (
    <Suspense fallback={null}>
      <Queue />
    </Suspense>
  );
}

async function Queue() {
  await requirePageRole(["ADMIN"]);

  // Oldest submissions first, so nothing waits forever.
  const listings = await prisma.gemstone.findMany({
    where: { status: "PENDING_REVIEW" },
    orderBy: [{ submittedAt: "asc" }, { createdAt: "asc" }],
    take: 100,
    select: {
      id: true,
      slug: true,
      title: true,
      species: true,
      caratWeight: true,
      priceMinor: true,
      priceOnRequest: true,
      currency: true,
      submittedAt: true,
      isDemo: true,
      seller: { select: { businessName: true, city: true, state: true } },
    },
  });

  type Row = (typeof listings)[number];
  const columns: Column<Row>[] = [
    { key: "submitted", header: "Submitted", cell: (listing) => <span className="whitespace-nowrap">{formatDate(listing.submittedAt)}</span> },
    {
      key: "listing",
      header: "Listing",
      cell: (listing) => (
        <div className="space-y-1">
          <span className="flex flex-wrap items-center gap-2 font-heading text-lg text-ink">
            {listing.title}
            {listing.isDemo ? <AdminDemoTag /> : null}
          </span>
          <p className="text-[12px] text-ink-soft">
            {[listing.species, listing.caratWeight ? `${listing.caratWeight.toString()} ct` : null].filter(Boolean).join(" · ")}
          </p>
        </div>
      ),
    },
    {
      key: "seller",
      header: "Seller",
      hideOnMobile: true,
      cell: (listing) => (
        <div className="space-y-1">
          <span>{listing.seller.businessName}</span>
          <p className="text-[12px] text-ink-soft">
            {listing.seller.city}, {listing.seller.state}
          </p>
        </div>
      ),
    },
    {
      key: "price",
      header: "Price",
      hideOnMobile: true,
      cell: (listing) => (listing.priceOnRequest ? "On request" : formatMoney(listing.priceMinor, listing.currency) ?? "-"),
    },
    {
      key: "review",
      header: "Review",
      align: "right",
      cell: (listing) => (
        <Link
          href={`/admin/listings/${listing.id}`}
          className="inline-flex min-h-11 items-center text-sm text-ink underline underline-offset-4 hover:text-accent-text"
        >
          Review<span className="sr-only"> {listing.title}</span>
        </Link>
      ),
    },
  ];

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Queue"
        title="Listing review queue"
        lead={`${listings.length} listing${listings.length === 1 ? "" : "s"} waiting for review, oldest first.`}
        actions={<ButtonLink href="/admin/listings/all" variant="secondary">All listings</ButtonLink>}
      />

      {listings.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title="The queue is empty"
          body="New listings from sellers appear here for review."
          action={
            <ButtonLink href="/admin/listings/all" variant="secondary">
              Browse all listings
            </ButtonLink>
          }
        />
      ) : (
        <div className="space-y-4">
          <Badge tone="warning">Waiting for review</Badge>
          <DataTable caption="Listings waiting for review" columns={columns} rows={listings} getRowKey={(listing) => listing.id} />
        </div>
      )}
    </div>
  );
}
