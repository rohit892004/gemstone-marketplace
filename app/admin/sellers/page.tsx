import Link from "next/link";
import { DemoBadge } from "@/components/catalogue/badges";
import { Suspense } from "react";
import { SELLER_PAGE_SIZE, SELLER_STATUS_FILTERS, parseSellerListParams, sellerWhere } from "@/lib/admin/seller-list";
import { requirePageRole } from "@/lib/auth/require-role";
import { prisma } from "@/lib/db/client";
import { formatDate, StatusBadge } from "@/components/admin/admin-ui";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default function AdminSellersPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={null}>
      <SellersList searchParams={searchParams} />
    </Suspense>
  );
}

const FILTER_LABELS: Record<(typeof SELLER_STATUS_FILTERS)[number], string> = {
  all: "All",
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  SUSPENDED: "Suspended",
};

function listHref(status: string, page: number): string {
  const query = new URLSearchParams({ status, page: String(page) });
  return `/admin/sellers?${query.toString()}`;
}

async function SellersList({ searchParams }: { searchParams: SearchParams }) {
  await requirePageRole(["ADMIN"]);
  const params = parseSellerListParams(await searchParams);
  const where = sellerWhere(params.status);

  const total = await prisma.sellerProfile.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / SELLER_PAGE_SIZE));
  const page = Math.min(params.page, pageCount);

  const sellers = await prisma.sellerProfile.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * SELLER_PAGE_SIZE,
    take: SELLER_PAGE_SIZE,
    select: {
      id: true,
      businessName: true,
      isDemo: true,
      city: true,
      state: true,
      specialties: true,
      approvalStatus: true,
      createdAt: true,
    },
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Sellers</h1>

      <nav aria-label="Filter by status" className="flex flex-wrap gap-2 text-sm">
        {SELLER_STATUS_FILTERS.map((status) => (
          <Link
            key={status}
            href={listHref(status, 1)}
            aria-current={status === params.status ? "page" : undefined}
            className={`rounded border px-3 py-1 ${
              status === params.status ? "border-stone-900 bg-stone-900 text-white" : "border-stone-300 bg-white"
            }`}
          >
            {FILTER_LABELS[status]}
          </Link>
        ))}
      </nav>

      <p className="text-sm text-stone-600">
        {total} seller{total === 1 ? "" : "s"}
      </p>

      {sellers.length === 0 ? (
        <p className="rounded border border-dashed border-stone-300 p-6 text-sm text-stone-600">
          No sellers match this filter.
        </p>
      ) : (
        <div className="relative overflow-x-auto rounded border border-stone-300 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-stone-100 text-xs uppercase tracking-wide text-stone-600">
              <tr>
                <th className="px-3 py-2">Business</th>
                <th className="px-3 py-2">City, state</th>
                <th className="px-3 py-2">Specialties</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Submitted</th>
                <th className="px-3 py-2">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {sellers.map((seller) => (
                <tr key={seller.id} className="border-t border-stone-200">
                  <td className="px-3 py-2 font-medium">
                    {seller.businessName}{" "}
                    {seller.isDemo ? <DemoBadge /> : null}
                  </td>
                  <td className="px-3 py-2">
                    {seller.city}, {seller.state}
                  </td>
                  <td className="px-3 py-2">{seller.specialties.length}</td>
                  <td className="px-3 py-2">
                    <StatusBadge status={seller.approvalStatus} />
                  </td>
                  <td className="px-3 py-2">{formatDate(seller.createdAt)}</td>
                  <td className="px-3 py-2 text-right">
                    <Link href={`/admin/sellers/${seller.id}`} className="underline">
                      Review
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pageCount > 1 ? (
        <nav aria-label="Pagination" className="flex items-center gap-4 text-sm">
          {page > 1 ? (
            <Link href={listHref(params.status, page - 1)} className="underline">
              Previous
            </Link>
          ) : (
            <span className="text-stone-400">Previous</span>
          )}
          <span>
            Page {page} of {pageCount}
          </span>
          {page < pageCount ? (
            <Link href={listHref(params.status, page + 1)} className="underline">
              Next
            </Link>
          ) : (
            <span className="text-stone-400">Next</span>
          )}
        </nav>
      ) : null}
    </div>
  );
}
