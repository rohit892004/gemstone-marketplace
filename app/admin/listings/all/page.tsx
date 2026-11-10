import Link from "next/link";
import { Suspense } from "react";
import { ActionForm } from "@/components/admin/action-form";
import { formatDate } from "@/components/admin/admin-ui";
import { DemoBadge } from "@/components/catalogue/badges";
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

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">All listings</h1>

      <form method="get" action="/admin/listings/all" className="grid gap-3 rounded border border-stone-300 bg-white p-4 text-sm md:grid-cols-5">
        <label className="space-y-1">
          <span className="font-medium">Status</span>
          <select name="status" defaultValue={filters.status} className="w-full rounded border border-stone-300 p-2">
            {LISTING_STATUS_FILTERS.map((v) => (
              <option key={v} value={v}>{v === "all" ? "All" : v.replace(/_/g, " ").toLowerCase()}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="font-medium">Availability</span>
          <select name="availability" defaultValue={filters.availability} className="w-full rounded border border-stone-300 p-2">
            {AVAILABILITY_FILTERS.map((v) => (
              <option key={v} value={v}>{v === "all" ? "All" : v.toLowerCase()}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="font-medium">Featured</span>
          <select name="featured" defaultValue={filters.featured} className="w-full rounded border border-stone-300 p-2">
            {FEATURED_FILTERS.map((v) => (
              <option key={v} value={v}>{v === "all" ? "All" : v === "yes" ? "Featured" : "Not featured"}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="font-medium">Seller (business name)</span>
          <input name="seller" defaultValue={filters.seller} maxLength={80} className="w-full rounded border border-stone-300 p-2" />
        </label>
        <div className="flex items-end gap-2">
          <button type="submit" className="rounded bg-stone-900 px-4 py-2 text-white">Apply</button>
          <Link href="/admin/listings/all" className="px-2 py-2 underline">Clear</Link>
        </div>
      </form>

      <p className="text-sm text-stone-600">
        {total} listing{total === 1 ? "" : "s"}
      </p>

      {listings.length === 0 ? (
        <p className="rounded border border-dashed border-stone-300 p-6 text-sm text-stone-600">No listings match these filters.</p>
      ) : (
        <div className="relative overflow-x-auto rounded border border-stone-300 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-stone-300 bg-stone-50 text-xs uppercase tracking-wide text-stone-600">
              <tr>
                <th className="px-3 py-2">Listing</th>
                <th className="px-3 py-2">Seller</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Availability</th>
                <th className="px-3 py-2">Price</th>
                <th className="px-3 py-2">Published</th>
                <th className="px-3 py-2">Featured</th>
              </tr>
            </thead>
            <tbody>
              {listings.map((l) => (
                <tr key={l.id} className="border-b border-stone-200 align-top last:border-0">
                  <td className="px-3 py-2">
                    <Link href={`/admin/listings/${l.id}`} className="font-medium underline">{l.title}</Link>{" "}
                    {l.isDemo ? <DemoBadge /> : null}
                  </td>
                  <td className="px-3 py-2">{l.seller.businessName}</td>
                  <td className="px-3 py-2">{l.status.replace(/_/g, " ").toLowerCase()}</td>
                  <td className="px-3 py-2">{l.availability.toLowerCase()}</td>
                  <td className="px-3 py-2">{l.priceOnRequest ? "On request" : formatMoney(l.priceMinor, l.currency) ?? "-"}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{formatDate(l.publishedAt)}</td>
                  <td className="px-3 py-2">
                    {l.status === "PUBLISHED" ? (
                      <ActionForm
                        action={setListingFeatured}
                        hidden={{ listingId: l.id, featured: String(!l.featured) }}
                        title={l.featured ? "Featured" : "Not featured"}
                        submitLabel={l.featured ? "Unfeature" : "Feature"}
                      />
                    ) : (
                      <span className="text-stone-500">{l.featured ? "Yes" : "No"}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <nav aria-label="Pagination" className="flex items-center gap-4 text-sm">
        {page > 1 ? <Link href={href(filters, page - 1)} className="underline">Previous</Link> : null}
        <span>Page {page} of {pageCount}</span>
        {page < pageCount ? <Link href={href(filters, page + 1)} className="underline">Next</Link> : null}
      </nav>
    </div>
  );
}
