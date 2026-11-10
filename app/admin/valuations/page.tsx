import Link from "next/link";
import { Suspense } from "react";
import { ClipboardList } from "lucide-react";
import { requirePageRole } from "@/lib/auth/require-role";
import { formatDate } from "@/components/admin/admin-ui";
import { Button, buttonClasses } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Select } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import {
  ADMIN_VALUATION_PAGE_SIZE,
  ADMIN_VALUATION_STATUS_LABELS,
  ADMIN_VALUATION_STATUSES,
  adminValuationQuery,
  adminValuationWhere,
  parseAdminValuationFilters,
} from "@/lib/valuation/admin-filters";
import { prisma } from "@/lib/db/client";
import { formatCarat, statusLabel } from "@/lib/valuation/display";
import { VALUATION_ROUTES } from "@/lib/valuation/routes";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export const metadata = { title: "Valuations" };

export default function AdminValuationsPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={null}>
      <ValuationQueue searchParams={searchParams} />
    </Suspense>
  );
}

const SELECT = {
  id: true,
  reference: true,
  gemstoneType: true,
  caratMilli: true,
  status: true,
  source: true,
  submittedAt: true,
  createdAt: true,
  requester: { select: { name: true, email: true } },
  assignedValuator: { select: { name: true, email: true } },
} as const;

const LABEL = "block text-[13px] tracking-wide text-ink";
const FIELDSET_LEGEND = "text-[13px] tracking-wide text-ink";

async function ValuationQueue({ searchParams }: { searchParams: SearchParams }) {
  await requirePageRole(["ADMIN"]);
  const { filters, errors } = parseAdminValuationFilters(await searchParams);
  const where = adminValuationWhere(filters);

  const [total, rows, valuators] = await Promise.all([
    prisma.valuation.count({ where }),
    prisma.valuation.findMany({
      where,
      orderBy: [{ submittedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }, { id: "asc" }],
      skip: (filters.page - 1) * ADMIN_VALUATION_PAGE_SIZE,
      take: ADMIN_VALUATION_PAGE_SIZE,
      select: SELECT,
    }),
    prisma.user.findMany({
      where: { role: "VALUATOR" },
      orderBy: { email: "asc" },
      select: { id: true, name: true, email: true, status: true },
    }),
  ]);

  const pageCount = Math.max(1, Math.ceil(total / ADMIN_VALUATION_PAGE_SIZE));
  const page = Math.min(filters.page, pageCount);
  const errorList = Object.values(errors);
  const hasErrors = errorList.length > 0;

  type Row = (typeof rows)[number];
  const columns: Column<Row>[] = [
    { key: "reference", header: "Reference", cell: (row) => <span className="font-mono text-[13px]">{row.reference}</span> },
    {
      key: "gemstone",
      header: "Gemstone",
      cell: (row) => (
        <span className="space-y-1">
          <span className="block text-ink">{row.gemstoneType}</span>
          <span className="block text-[12px] text-ink-soft">{formatCarat(row.caratMilli)}</span>
        </span>
      ),
    },
    { key: "status", header: "Status", cell: (row) => statusLabel(row.status) },
    {
      key: "requester",
      header: "Requester",
      hideOnMobile: true,
      cell: (row) => (
        <span className="space-y-1">
          <span className="block">{row.requester.name ?? "-"}</span>
          <span className="block text-[12px] text-ink-soft">{row.requester.email}</span>
        </span>
      ),
    },
    {
      key: "valuer",
      header: "Valuer",
      hideOnMobile: true,
      cell: (row) => (row.assignedValuator ? (row.assignedValuator.name ?? row.assignedValuator.email) : "Unassigned"),
    },
    { key: "source", header: "Source", hideOnMobile: true, cell: (row) => (row.source === "LISTING" ? "Listing" : "Standalone") },
    { key: "submitted", header: "Submitted", hideOnMobile: true, cell: (row) => <span className="whitespace-nowrap">{formatDate(row.submittedAt)}</span> },
    {
      key: "open",
      header: "Open",
      align: "right",
      cell: (row) => (
        <Link href={VALUATION_ROUTES.adminDetail(row.id)} className="inline-flex min-h-11 items-center text-ink underline underline-offset-4 hover:text-accent-text">
          Open<span className="sr-only"> {row.reference}</span>
        </Link>
      ),
    },
  ];

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Admin" title="Valuations" />

      {hasErrors ? (
        <div role="alert" className="border-l-2 border-danger bg-surface-raised px-5 py-4 text-sm text-danger">
          <p className="font-medium">Please fix the following:</p>
          <ul className="list-disc pl-5">
            {errorList.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <form method="get" action={VALUATION_ROUTES.adminQueue} className="grid gap-6 border border-line bg-surface-raised p-5 sm:p-6 md:grid-cols-3">
        <fieldset className="space-y-3">
          <legend className={FIELDSET_LEGEND}>Status</legend>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            {ADMIN_VALUATION_STATUSES.map((status) => (
              <label key={status} className="flex min-h-11 items-center gap-3 text-sm text-ink">
                <input type="checkbox" name="status" value={status} defaultChecked={filters.statuses.includes(status)} className="h-4 w-4 accent-brand" />
                {ADMIN_VALUATION_STATUS_LABELS[status]}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="space-y-5">
          <label className="block space-y-2">
            <span className={LABEL}>Assignment</span>
            <Select name="assignment" defaultValue={filters.assignment}>
              <option value="all">All</option>
              <option value="unassigned">Unassigned</option>
              {valuators.map((v) => (
                <option key={v.id} value={v.id}>
                  {(v.name ?? v.email) + (v.status === "ACTIVE" ? "" : " (deactivated)")}
                </option>
              ))}
            </Select>
          </label>
          <label className="block space-y-2">
            <span className={LABEL}>Source</span>
            <Select name="source" defaultValue={filters.source}>
              <option value="all">All</option>
              <option value="LISTING">From a listing</option>
              <option value="STANDALONE">Standalone</option>
            </Select>
          </label>
          <label className="block space-y-2">
            <span className={LABEL}>Exact reference</span>
            <span className="block text-[12px] text-ink-soft">For example GSV-26-K7Q2M9.</span>
            <Input name="ref" defaultValue={filters.reference ?? ""} maxLength={20} className="font-mono" />
          </label>
        </div>

        <div className="space-y-5">
          <label className="block space-y-2">
            <span className={LABEL}>Submitted from</span>
            <Input type="date" name="from" defaultValue={filters.fromText} aria-invalid={errors.from ? true : undefined} />
          </label>
          <label className="block space-y-2">
            <span className={LABEL}>Submitted to (inclusive)</span>
            <Input type="date" name="to" defaultValue={filters.toText} aria-invalid={errors.to ? true : undefined} />
          </label>
          <div className="flex flex-wrap items-center gap-4 pt-2">
            <Button type="submit">Apply filters</Button>
            <Link href={VALUATION_ROUTES.adminQueue} className="inline-flex min-h-11 items-center text-sm underline underline-offset-4">
              Clear
            </Link>
          </div>
        </div>
      </form>

      <p className="text-sm text-ink-soft" aria-live="polite">
        {total} valuation{total === 1 ? "" : "s"}
      </p>

      {rows.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No valuations match these filters"
          body="Clear the filters to see every valuation request."
          action={
            <Link href={VALUATION_ROUTES.adminQueue} className={buttonClasses({ variant: "secondary" })}>
              Clear filters
            </Link>
          }
        />
      ) : (
        <DataTable caption="Valuation requests" columns={columns} rows={rows} getRowKey={(row) => row.id} />
      )}

      {pageCount > 1 ? (
        <nav aria-label="Pagination" className="flex flex-wrap items-center gap-6 text-sm">
          {page > 1 ? (
            <Link href={adminValuationQuery(filters, page - 1)} className="inline-flex min-h-11 items-center underline underline-offset-4">
              Previous
            </Link>
          ) : (
            <span className="text-ink-soft">Previous</span>
          )}
          <span className="text-ink-soft">
            Page {page} of {pageCount}
          </span>
          {page < pageCount ? (
            <Link href={adminValuationQuery(filters, page + 1)} className="inline-flex min-h-11 items-center underline underline-offset-4">
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
