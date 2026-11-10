import Link from "next/link";
import { Suspense } from "react";
import { InventoryBulkForm } from "@/components/seller/inventory-bulk-form";
import { InventoryQuantityForm } from "@/components/seller/inventory-quantity-form";
import { AwaitingApprovalPage } from "@/components/seller/seller-pages";
import { requireRole } from "@/lib/auth/require-role";
import { gateApprovedSeller } from "@/lib/seller/approved-gate";
import { availabilityLabels, listingStatusLabels } from "@/lib/seller-catalogue/labels";
import { parseListingsQuery, pageCount } from "@/lib/seller-catalogue/listings-query";
import { loadSellerInventory } from "@/lib/seller-catalogue/load";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const BULK_FORM_ID = "inventory-bulk";

export default function SellerInventoryPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={null}>
      <SellerInventoryView searchParams={searchParams} />
    </Suspense>
  );
}

async function SellerInventoryView({ searchParams }: { searchParams: SearchParams }) {
  const gate = await gateApprovedSeller();
  if (gate !== "approved") return <AwaitingApprovalPage title="Inventory" />;

  const user = await requireRole(["SELLER"], { sellerApproved: true });
  const { page } = parseListingsQuery(await searchParams);
  const data = await loadSellerInventory(user.id, { page });

  return (
    <section className="mx-auto max-w-6xl space-y-8 px-4 py-10 sm:px-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Inventory</h1>
        <p className="text-sm text-ink-soft">
          Change availability for several listings at once, or edit quantities. Changes apply immediately to your listings.
        </p>
      </header>

      <InventoryBulkForm formId={BULK_FORM_ID} />

      {data.rows.length === 0 ? (
        <p className="text-ink-soft">You have no listings yet.</p>
      ) : (
        <div className="relative overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <caption className="sr-only">Listing inventory</caption>
            <thead className="border-b border-line text-ink-soft">
              <tr>
                <th scope="col" className="py-2 pr-4 font-medium">
                  <span className="sr-only">Select</span>
                </th>
                <th scope="col" className="py-2 pr-4 font-medium">Title</th>
                <th scope="col" className="py-2 pr-4 font-medium">Status</th>
                <th scope="col" className="py-2 pr-4 font-medium">Availability</th>
                <th scope="col" className="py-2 font-medium">Quantity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.rows.map((row) => (
                <tr key={row.id}>
                  <td className="py-3 pr-4">
                    <input
                      type="checkbox"
                      name="ids"
                      value={row.id}
                      form={BULK_FORM_ID}
                      aria-label={`Select ${row.title}`}
                      className="h-4 w-4"
                    />
                  </td>
                  <td className="py-3 pr-4 font-medium text-ink">
                    <Link href={`/seller/listings/${row.id}/edit`} className="underline">
                      {row.title}
                    </Link>
                  </td>
                  <td className="py-3 pr-4 text-ink-soft">{listingStatusLabels[row.status] ?? row.status}</td>
                  <td className="py-3 pr-4 text-ink-soft">{availabilityLabels[row.availability] ?? row.availability}</td>
                  <td className="py-3">
                    <InventoryQuantityForm listingId={row.id} quantity={row.quantity} title={row.title} />
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
            <Link href={`/seller/inventory?page=${data.page - 1}`} className="text-brand underline">
              Previous
            </Link>
          ) : (
            <span />
          )}
          <span className="text-ink-soft">
            Page {data.page} of {pageCount(data.total)}
          </span>
          {data.page < data.pages ? (
            <Link href={`/seller/inventory?page=${data.page + 1}`} className="text-brand underline">
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
