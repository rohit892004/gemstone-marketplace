import Link from "next/link";
import { Suspense } from "react";
import { requirePageRole } from "@/lib/auth/require-role";
import { formatDate } from "@/components/admin/admin-ui";
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

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Valuations</h1>

      {hasErrors ? (
        <div role="alert" className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          <p className="font-medium">Please fix the following:</p>
          <ul className="list-disc pl-5">
            {errorList.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <form method="get" action={VALUATION_ROUTES.adminQueue} className="grid grid-cols-1 gap-4 rounded border border-stone-300 bg-white p-4 text-sm md:grid-cols-3">
        <fieldset className="space-y-1">
          <legend className="font-medium">Status</legend>
          <div className="grid grid-cols-2 gap-1">
            {ADMIN_VALUATION_STATUSES.map((status) => (
              <label key={status} className="flex items-center gap-2">
                <input type="checkbox" name="status" value={status} defaultChecked={filters.statuses.includes(status)} />
                {ADMIN_VALUATION_STATUS_LABELS[status]}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="space-y-3">
          <label className="block space-y-1">
            <span className="font-medium">Assignment</span>
            <select name="assignment" defaultValue={filters.assignment} className="w-full rounded border border-stone-300 p-2">
              <option value="all">All</option>
              <option value="unassigned">Unassigned</option>
              {valuators.map((v) => (
                <option key={v.id} value={v.id}>
                  {(v.name ?? v.email) + (v.status === "ACTIVE" ? "" : " (deactivated)")}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1">
            <span className="font-medium">Source</span>
            <select name="source" defaultValue={filters.source} className="w-full rounded border border-stone-300 p-2">
              <option value="all">All</option>
              <option value="LISTING">From a listing</option>
              <option value="STANDALONE">Standalone</option>
            </select>
          </label>
          <label className="block space-y-1">
            <span className="font-medium">Exact reference</span>
            <span className="block text-stone-600">For example GSV-26-K7Q2M9.</span>
            <input name="ref" defaultValue={filters.reference ?? ""} maxLength={20} className="w-full rounded border border-stone-300 p-2 font-mono" />
          </label>
        </div>

        <div className="space-y-3">
          <label className="block space-y-1">
            <span className="font-medium">Submitted from</span>
            <input type="date" name="from" defaultValue={filters.fromText} aria-invalid={errors.from ? true : undefined} className="w-full rounded border border-stone-300 p-2" />
          </label>
          <label className="block space-y-1">
            <span className="font-medium">Submitted to (inclusive)</span>
            <input type="date" name="to" defaultValue={filters.toText} aria-invalid={errors.to ? true : undefined} className="w-full rounded border border-stone-300 p-2" />
          </label>
          <div className="flex gap-3 pt-2">
            <button type="submit" className="min-h-11 rounded bg-stone-900 px-4 py-2 text-white">
              Apply filters
            </button>
            <Link href={VALUATION_ROUTES.adminQueue} className="min-h-11 rounded border border-stone-300 px-4 py-2">
              Clear
            </Link>
          </div>
        </div>
      </form>

      <p className="text-sm text-stone-600" aria-live="polite">
        {total} valuation{total === 1 ? "" : "s"}
      </p>

      {rows.length === 0 ? (
        <p className="rounded border border-dashed border-stone-300 p-6 text-sm text-stone-600">No valuations match these filters.</p>
      ) : (
        <div className="overflow-x-auto rounded border border-stone-300 bg-white">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Valuation requests</caption>
            <thead className="bg-stone-100 text-xs uppercase tracking-wide text-stone-600">
              <tr>
                <th scope="col" className="px-3 py-2">Reference</th>
                <th scope="col" className="px-3 py-2">Gemstone</th>
                <th scope="col" className="px-3 py-2">Status</th>
                <th scope="col" className="px-3 py-2">Requester</th>
                <th scope="col" className="px-3 py-2">Valuer</th>
                <th scope="col" className="px-3 py-2">Source</th>
                <th scope="col" className="px-3 py-2">Submitted</th>
                <th scope="col" className="px-3 py-2">
                  <span className="sr-only">Open</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-stone-200 align-top">
                  <td className="px-3 py-2 font-mono text-xs">{row.reference}</td>
                  <td className="px-3 py-2">
                    {row.gemstoneType}
                    <span className="block text-xs text-stone-600">{formatCarat(row.caratMilli)}</span>
                  </td>
                  <td className="px-3 py-2">{statusLabel(row.status)}</td>
                  <td className="px-3 py-2">
                    {row.requester.name ?? "-"}
                    <span className="block text-xs text-stone-600">{row.requester.email}</span>
                  </td>
                  <td className="px-3 py-2">{row.assignedValuator ? (row.assignedValuator.name ?? row.assignedValuator.email) : "Unassigned"}</td>
                  <td className="px-3 py-2">{row.source === "LISTING" ? "Listing" : "Standalone"}</td>
                  <td className="px-3 py-2">{formatDate(row.submittedAt)}</td>
                  <td className="px-3 py-2 text-right">
                    <Link href={VALUATION_ROUTES.adminDetail(row.id)} className="underline">
                      Open<span className="sr-only"> {row.reference}</span>
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
            <Link href={adminValuationQuery(filters, page - 1)} className="underline">
              Previous
            </Link>
          ) : (
            <span className="text-stone-400">Previous</span>
          )}
          <span>
            Page {page} of {pageCount}
          </span>
          {page < pageCount ? (
            <Link href={adminValuationQuery(filters, page + 1)} className="underline">
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
