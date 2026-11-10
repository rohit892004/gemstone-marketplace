import Link from "next/link";
import { Suspense } from "react";
import { Users } from "lucide-react";
import { SELLER_PAGE_SIZE, SELLER_STATUS_FILTERS, parseSellerListParams, sellerWhere } from "@/lib/admin/seller-list";
import { requirePageRole } from "@/lib/auth/require-role";
import { prisma } from "@/lib/db/client";
import { AdminDemoTag, formatDate, StatusBadge } from "@/components/admin/admin-ui";
import { ButtonLink } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs } from "@/components/ui/tabs";

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

  const columns: Column<(typeof sellers)[number]>[] = [
    {
      key: "business",
      header: "Business",
      cell: (seller) => (
        <span className="font-heading text-lg text-ink">
          {seller.businessName}
          {seller.isDemo ? <AdminDemoTag /> : null}
        </span>
      ),
    },
    { key: "place", header: "City, state", hideOnMobile: true, cell: (seller) => <span>{seller.city}, {seller.state}</span> },
    { key: "specialties", header: "Specialties", hideOnMobile: true, cell: (seller) => <span className="tabular-nums">{seller.specialties.length}</span> },
    { key: "status", header: "Status", cell: (seller) => <StatusBadge status={seller.approvalStatus} /> },
    { key: "submitted", header: "Submitted", hideOnMobile: true, cell: (seller) => <span className="whitespace-nowrap">{formatDate(seller.createdAt)}</span> },
    {
      key: "review",
      header: "Actions",
      align: "right",
      cell: (seller) => (
        <Link
          href={`/admin/sellers/${seller.id}`}
          className="inline-flex min-h-11 items-center text-sm text-ink underline underline-offset-4 hover:text-accent-text"
        >
          Review<span className="sr-only"> {seller.businessName}</span>
        </Link>
      ),
    },
  ];

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Admin" title="Sellers" lead={`${total} seller${total === 1 ? "" : "s"}`} />

      <Tabs
        label="Filter by status"
        items={SELLER_STATUS_FILTERS.map((status) => ({
          href: listHref(status, 1),
          label: FILTER_LABELS[status],
          active: status === params.status,
        }))}
      />

      <DataTable
        caption="Sellers"
        columns={columns}
        rows={sellers}
        getRowKey={(seller) => seller.id}
        empty={
          <EmptyState
            icon={Users}
            title="No sellers match this filter"
            body="Try another status, or check back once new seller applications come in."
            action={
              <ButtonLink href="/admin/sellers" variant="secondary">
                Show all sellers
              </ButtonLink>
            }
          />
        }
      />

      {pageCount > 1 ? (
        <nav aria-label="Pagination" className="flex flex-wrap items-center gap-6 text-sm">
          {page > 1 ? (
            <Link href={listHref(params.status, page - 1)} className="inline-flex min-h-11 items-center underline underline-offset-4">
              Previous
            </Link>
          ) : (
            <span className="text-ink-soft">Previous</span>
          )}
          <span className="text-ink-soft">
            Page {page} of {pageCount}
          </span>
          {page < pageCount ? (
            <Link href={listHref(params.status, page + 1)} className="inline-flex min-h-11 items-center underline underline-offset-4">
              Next
            </Link>
          ) : (
            <span className="text-ink-soft">Next</span>
          )}
        </nav>
      ) : null}
    </div>
  );
}
