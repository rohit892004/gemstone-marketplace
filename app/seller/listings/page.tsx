import Link from "next/link";
import { Suspense } from "react";
import { AwaitingApprovalPage } from "@/components/seller/seller-pages";
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

async function SellerListingsView({ searchParams }: { searchParams: SearchParams }) {
  const state = await gateApprovedSeller();
  if (state !== "approved") return <AwaitingApprovalPage title="Listings" />;

  const user = await requireRole(["SELLER"], { sellerApproved: true });
  const query = parseListingsQuery(await searchParams);
  const data = await loadSellerListings(user.id, query);
  const linkFor = (page: number) => `/seller/listings?status=${query.status}&page=${page}`;

  return (
    <section className="mx-auto max-w-6xl space-y-6 px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Listings</h1>
        <Link href="/seller/listings/new" className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white">
          New listing
        </Link>
      </div>

      <nav aria-label="Filter by status">
        <ul className="flex flex-wrap gap-2">
          {filters.map((filter) => (
            <li key={filter.value}>
              <Link
                href={`/seller/listings?status=${filter.value}`}
                aria-current={query.status === filter.value ? "page" : undefined}
                className={`rounded-full border px-3 py-1 text-sm ${
                  query.status === filter.value ? "border-brand bg-brand text-white" : "border-line text-ink-soft"
                }`}
              >
                {filter.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {data.rows.length === 0 ? (
        <p className="text-ink-soft">No listings match this filter.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <caption className="sr-only">Your listings</caption>
            <thead className="border-b border-line text-ink-soft">
              <tr>
                <th scope="col" className="py-2 pr-4 font-medium">Title</th>
                <th scope="col" className="py-2 pr-4 font-medium">Status</th>
                <th scope="col" className="py-2 pr-4 font-medium">Availability</th>
                <th scope="col" className="py-2 pr-4 font-medium">Price</th>
                <th scope="col" className="py-2 pr-4 font-medium">Media</th>
                <th scope="col" className="py-2 pr-4 font-medium">Documents</th>
                <th scope="col" className="py-2 font-medium"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.rows.map((row) => (
                <tr key={row.id}>
                  <td className="py-3 pr-4 font-medium text-ink">{row.title}</td>
                  <td className="py-3 pr-4 text-ink-soft">{listingStatusLabels[row.status] ?? row.status}</td>
                  <td className="py-3 pr-4 text-ink-soft">{availabilityLabels[row.availability] ?? row.availability}</td>
                  <td className="py-3 pr-4 text-ink-soft">
                    {priceLabel({ priceMinor: row.priceMinor, priceOnRequest: row.priceOnRequest, currency: row.currency })}
                  </td>
                  <td className="py-3 pr-4 text-ink-soft">{row._count.media}</td>
                  <td className="py-3 pr-4 text-ink-soft">{row._count.documents}</td>
                  <td className="py-3">
                    <Link href={`/seller/listings/${row.id}/edit`} className="font-medium text-brand underline">
                      Edit<span className="sr-only"> {row.title}</span>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data.pages > 1 ? (
        <nav aria-label="Pagination" className="flex items-center justify-between text-sm">
          {data.page > 1 ? (
            <Link href={linkFor(data.page - 1)} className="text-brand underline">
              Previous
            </Link>
          ) : (
            <span />
          )}
          <span className="text-ink-soft">
            Page {data.page} of {pageCount(data.total)}
          </span>
          {data.page < data.pages ? (
            <Link href={linkFor(data.page + 1)} className="text-brand underline">
              Next
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </section>
  );
}
