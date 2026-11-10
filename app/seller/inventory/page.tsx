import Link from "next/link";
import { Suspense } from "react";
import { Boxes } from "lucide-react";
import { InventoryBulkForm } from "@/components/seller/inventory-bulk-form";
import { InventoryQuantityForm } from "@/components/seller/inventory-quantity-form";
import { AwaitingApprovalPage } from "@/components/seller/seller-pages";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireRole } from "@/lib/auth/require-role";
import { gateApprovedSeller } from "@/lib/seller/approved-gate";
import { availabilityLabels, listingStatusLabels } from "@/lib/seller-catalogue/labels";
import { parseListingsQuery, pageCount } from "@/lib/seller-catalogue/listings-query";
import { loadSellerInventory } from "@/lib/seller-catalogue/load";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const BULK_FORM_ID = "inventory-bulk";

const statusTone: Record<string, BadgeTone> = {
  PUBLISHED: "success",
  PENDING_REVIEW: "warning",
  REJECTED: "danger",
};

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

  type Row = (typeof data.rows)[number];
  const columns: Column<Row>[] = [
    {
      key: "select",
      header: "Select",
      cell: (row) => (
        <input
          type="checkbox"
          name="ids"
          value={row.id}
          form={BULK_FORM_ID}
          aria-label={`Select ${row.title}`}
          className="h-5 w-5"
        />
      ),
    },
    {
      key: "title",
      header: "Title",
      cell: (row) => (
        <Link href={`/seller/listings/${row.id}/edit`} className="font-heading text-lg text-ink underline underline-offset-4 hover:text-accent-text">
          {row.title}
        </Link>
      ),
    },
    {
      key: "status",
      header: "Status",
      hideOnMobile: true,
      cell: (row) => <Badge tone={statusTone[row.status] ?? "neutral"}>{listingStatusLabels[row.status] ?? row.status}</Badge>,
    },
    { key: "availability", header: "Availability", hideOnMobile: true, cell: (row) => availabilityLabels[row.availability] ?? row.availability },
    { key: "quantity", header: "Quantity", cell: (row) => <InventoryQuantityForm listingId={row.id} quantity={row.quantity} title={row.title} /> },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Catalogue"
        title="Inventory"
        lead="Change availability for several listings at once, or edit quantities. Changes apply immediately to your listings."
      />

      <InventoryBulkForm formId={BULK_FORM_ID} />

      <DataTable
        caption="Listing inventory"
        columns={columns}
        rows={data.rows}
        getRowKey={(row) => row.id}
        empty={
          <EmptyState
            icon={Boxes}
            title="You have no listings yet"
            body="Inventory appears here once you have added a listing."
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
            <Link href={`/seller/inventory?page=${data.page - 1}`} className="inline-flex min-h-11 items-center text-ink underline underline-offset-4">
              Previous
            </Link>
          ) : (
            <span />
          )}
          <span className="text-ink-soft">
            Page {data.page} of {pageCount(data.total)}
          </span>
          {data.page < data.pages ? (
            <Link href={`/seller/inventory?page=${data.page + 1}`} className="inline-flex min-h-11 items-center text-ink underline underline-offset-4">
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
