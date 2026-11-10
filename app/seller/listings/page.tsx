import Link from "next/link";
import { Suspense } from "react";
import { Gem, Plus } from "lucide-react";
import { AwaitingApprovalPage } from "@/components/seller/seller-pages";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs } from "@/components/ui/tabs";
import { requireRole } from "@/lib/auth/require-role";
import { gateApprovedSeller } from "@/lib/seller/approved-gate";
import { availabilityLabels, listingStatusLabels, priceLabel } from "@/lib/seller-catalogue/labels";
import { parseListingsQuery, pageCount, type ListingStatusFilter } from "@/lib/seller-catalogue/listings-query";
import { loadSellerListings } from "@/lib/seller-catalogue/load";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default function SellerListingsPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={null}>
      <SellerListingsView searchParams={searchParams} />
    </Suspense>
  );
}

const filters: { value: ListingStatusFilter; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "DRAFT", label: "Draft" },
  { value: "PENDING_REVIEW", label: "Awaiting review" },
  { value: "PUBLISHED", label: "Published" },
  { value: "REJECTED", label: "Rejected" },
  { value: "ARCHIVED", label: "Archived" },
];

const statusTone: Record<string, BadgeTone> = {
  PUBLISHED: "success",
  PENDING_REVIEW: "warning",
  REJECTED: "danger",
};

async function SellerListingsView({ searchParams }: { searchParams: SearchParams }) {
  const state = await gateApprovedSeller();
  if (state !== "approved") return <AwaitingApprovalPage title="Listings" />;

  const user = await requireRole(["SELLER"], { sellerApproved: true });
  const query = parseListingsQuery(await searchParams);
  const data = await loadSellerListings(user.id, query);
  const linkFor = (page: number) => `/seller/listings?status=${query.status}&page=${page}`;

  const columns: Column<(typeof data.rows)[number]>[] = [
    { key: "title", header: "Title", cell: (row) => <span className="font-heading text-lg text-ink">{row.title}</span> },
    {
      key: "status",
      header: "Status",
      cell: (row) => <Badge tone={statusTone[row.status] ?? "neutral"}>{listingStatusLabels[row.status] ?? row.status}</Badge>,
    },
    { key: "availability", header: "Availability", hideOnMobile: true, cell: (row) => availabilityLabels[row.availability] ?? row.availability },
    {
      key: "price",
      header: "Price",
      hideOnMobile: true,
      cell: (row) => priceLabel({ priceMinor: row.priceMinor, priceOnRequest: row.priceOnRequest, currency: row.currency }),
    },
    { key: "media", header: "Media", hideOnMobile: true, align: "right", cell: (row) => row._count.media },
    { key: "documents", header: "Documents", hideOnMobile: true, align: "right", cell: (row) => row._count.documents },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      cell: (row) => (
        <Link
          href={`/seller/listings/${row.id}/edit`}
          className="inline-flex min-h-11 items-center px-2 text-sm font-medium text-ink underline underline-offset-4 hover:text-accent-text"
        >
          Edit<span className="sr-only"> {row.title}</span>
        </Link>
      ),
    },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Catalogue"
        title="Listings"
        lead="Stones you offer to buyers. Drafts stay private until you submit them for review."
        actions={
          <ButtonLink href="/seller/listings/new" variant="gold">
            <Plus className="h-4 w-4" strokeWidth={1.25} aria-hidden />
            New listing
          </ButtonLink>
        }
      />

      <Tabs
        label="Filter by status"
        items={filters.map((filter) => ({
          href: `/seller/listings?status=${filter.value}`,
          label: filter.label,
          active: query.status === filter.value,
        }))}
      />

      <DataTable
        caption="Your listings"
        columns={columns}
        rows={data.rows}
        getRowKey={(row) => row.id}
        empty={
          <EmptyState
            icon={Gem}
            title="No listings match this filter"
            body="Try another status, or add a new stone to start a listing."
            action={
              <ButtonLink href="/seller/listings/new" variant="secondary">
                New listing
              </ButtonLink>
            }
            className="border-0 p-6 text-left sm:p-8"
          />
        }
      />

      {data.pages > 1 ? (
        <nav aria-label="Pagination" className="flex items-center justify-between text-sm">
          {data.page > 1 ? (
            <Link href={linkFor(data.page - 1)} className="inline-flex min-h-11 items-center text-ink underline underline-offset-4">
              Previous
            </Link>
          ) : (
            <span />
          )}
          <span className="text-ink-soft">
            Page {data.page} of {pageCount(data.total)}
          </span>
          {data.page < data.pages ? (
            <Link href={linkFor(data.page + 1)} className="inline-flex min-h-11 items-center text-ink underline underline-offset-4">
              Next
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </div>
  );
}
