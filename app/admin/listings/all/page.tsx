import Link from "next/link";
import { Suspense } from "react";
import { Gem } from "lucide-react";
import { ActionForm } from "@/components/admin/action-form";
import { AdminDemoTag, formatDate } from "@/components/admin/admin-ui";
import { Button, buttonClasses } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Select } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import {
  ADMIN_PAGE_SIZE,
  AVAILABILITY_FILTERS,
  FEATURED_FILTERS,
  LISTING_STATUS_FILTERS,
  listingWhere,
  parseListingFilters,
  type ListingFilters,
} from "@/lib/admin-catalogue/schemas";
import { requirePageRole } from "@/lib/auth/require-role";
import { prisma } from "@/lib/db/client";
import { formatMoney } from "@/lib/money/money";
import { setListingFeatured } from "../actions";

export const metadata = { title: "All listings", robots: { index: false, follow: false } };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default function AdminAllListingsPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={null}>
      <AllListings searchParams={searchParams} />
    </Suspense>
  );
}

function href(filters: ListingFilters, page: number): string {
  const query = new URLSearchParams({
    status: filters.status,
    availability: filters.availability,
    featured: filters.featured,
    seller: filters.seller,
    page: String(page),
  });
  return `/admin/listings/all?${query.toString()}`;
}

const LABEL = "block text-[13px] tracking-wide text-ink";

async function AllListings({ searchParams }: { searchParams: SearchParams }) {
  await requirePageRole(["ADMIN"]);
  const filters = parseListingFilters(await searchParams);
  const where = listingWhere(filters);

  const total = await prisma.gemstone.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE));
  const page = Math.min(filters.page, pageCount);

  const listings = await prisma.gemstone.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    skip: (page - 1) * ADMIN_PAGE_SIZE,
    take: ADMIN_PAGE_SIZE,
    select: {
      id: true,
      slug: true,
      title: true,
      status: true,
      availability: true,
      featured: true,
      isDemo: true,
      priceMinor: true,
      priceOnRequest: true,
      currency: true,
      publishedAt: true,
      seller: { select: { businessName: true } },
    },
  });

  type Row = (typeof listings)[number];
  const columns: Column<Row>[] = [
    {
      key: "listing",
      header: "Listing",
      cell: (l) => (
        <span className="flex flex-wrap items-center gap-2">
          <Link href={`/admin/listings/${l.id}`} className="font-heading text-lg text-ink underline-offset-4 hover:underline">
            {l.title}
          </Link>
          {l.isDemo ? <AdminDemoTag /> : null}
        </span>
      ),
    },
    { key: "seller", header: "Seller", cell: (l) => l.seller.businessName },
    { key: "status", header: "Status", cell: (l) => <span className="capitalize">{l.status.replace(/_/g, " ").toLowerCase()}</span> },
    { key: "availability", header: "Availability", hideOnMobile: true, cell: (l) => <span className="capitalize">{l.availability.toLowerCase()}</span> },
    {
      key: "price",
      header: "Price",
      hideOnMobile: true,
      cell: (l) => (l.priceOnRequest ? "On request" : formatMoney(l.priceMinor, l.currency) ?? "-"),
    },
    { key: "published", header: "Published", hideOnMobile: true, cell: (l) => <span className="whitespace-nowrap">{formatDate(l.publishedAt)}</span> },
    {
      key: "featured",
      header: "Featured",
      cell: (l) =>
        l.status === "PUBLISHED" ? (
          <ActionForm
            action={setListingFeatured}
            hidden={{ listingId: l.id, featured: String(!l.featured) }}
            title={l.featured ? "Featured" : "Not featured"}
            submitLabel={l.featured ? "Unfeature" : "Feature"}
          />
        ) : (
          <span className="text-ink-soft">{l.featured ? "Yes" : "No"}</span>
        ),
    },
  ];

  return (
    <div className="space-y-10">
      <PageHeader eyebrow="Marketplace" title="All listings" lead={`${total} listing${total === 1 ? "" : "s"}`} />

      <form method="get" action="/admin/listings/all" className="grid gap-6 border border-line bg-surface-raised p-5 sm:p-6 md:grid-cols-5">
        <label className="space-y-2">
          <span className={LABEL}>Status</span>
          <Select name="status" defaultValue={filters.status}>
            {LISTING_STATUS_FILTERS.map((v) => (
              <option key={v} value={v}>
                {v === "all" ? "All" : v.replace(/_/g, " ").toLowerCase()}
              </option>
            ))}
          </Select>
        </label>
        <label className="space-y-2">
          <span className={LABEL}>Availability</span>
          <Select name="availability" defaultValue={filters.availability}>
            {AVAILABILITY_FILTERS.map((v) => (
              <option key={v} value={v}>
                {v === "all" ? "All" : v.toLowerCase()}
              </option>
            ))}
          </Select>
        </label>
        <label className="space-y-2">
          <span className={LABEL}>Featured</span>
          <Select name="featured" defaultValue={filters.featured}>
            {FEATURED_FILTERS.map((v) => (
              <option key={v} value={v}>
                {v === "all" ? "All" : v === "yes" ? "Featured" : "Not featured"}
              </option>
            ))}
          </Select>
        </label>
        <label className="space-y-2">
          <span className={LABEL}>Seller (business name)</span>
          <Input name="seller" defaultValue={filters.seller} maxLength={80} />
        </label>
        <div className="flex flex-wrap items-end gap-3">
          <Button type="submit">Apply</Button>
          <Link href="/admin/listings/all" className="inline-flex min-h-11 items-center px-2 text-sm underline underline-offset-4">
            Clear
          </Link>
        </div>
      </form>

      {listings.length === 0 ? (
        <EmptyState
          icon={Gem}
          title="No listings match these filters"
          body="Clear the filters to see every listing, or try another status."
          action={
            <Link href="/admin/listings/all" className={buttonClasses({ variant: "secondary" })}>
              Clear filters
            </Link>
          }
        />
      ) : (
        <DataTable caption="All listings" columns={columns} rows={listings} getRowKey={(l) => l.id} />
      )}

      <nav aria-label="Pagination" className="flex flex-wrap items-center gap-6 text-sm">
        {page > 1 ? (
          <Link href={href(filters, page - 1)} className="inline-flex min-h-11 items-center underline underline-offset-4">
            Previous
          </Link>
        ) : null}
        <span className="text-ink-soft">
          Page {page} of {pageCount}
        </span>
        {page < pageCount ? (
          <Link href={href(filters, page + 1)} className="inline-flex min-h-11 items-center underline underline-offset-4">
            Next
          </Link>
        ) : null}
      </nav>
    </div>
  );
}
