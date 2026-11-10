import Link from "next/link";
import { Suspense } from "react";
import { requirePageRole } from "@/lib/auth/require-role";
import { formatDate } from "@/components/admin/admin-ui";
import { formatCarat, statusLabel } from "@/lib/valuation/display";
import { expertReasonLabel, loadValuatorQueue } from "@/lib/valuation/valuator-queue";
import { VALUATION_ROUTES } from "@/lib/valuation/routes";

export const metadata = { title: "My queue" };

export default function ValuatorQueuePage() {
  return (
    <Suspense fallback={null}>
      <QueueList />
    </Suspense>
  );
}

/** Only the stone and status fields are loaded. The requester is never part of this page. */
async function QueueList() {
  const user = await requirePageRole(["VALUATOR"]);
  const rows = await loadValuatorQueue(user.id);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">My queue</h1>
      <p className="text-sm text-stone-600">
        Requests assigned to you that need an expert decision or an answer. Open a request to review it.
      </p>

      {rows.length === 0 ? (
        <p className="rounded border border-dashed border-stone-300 p-6 text-sm text-stone-600">
          Nothing is waiting for you right now.
        </p>
      ) : (
        <div className="overflow-x-auto rounded border border-stone-300 bg-white">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Requests assigned to you</caption>
            <thead className="bg-stone-100 text-xs uppercase tracking-wide text-stone-600">
              <tr>
                <th scope="col" className="px-3 py-2">Reference</th>
                <th scope="col" className="px-3 py-2">Gemstone</th>
                <th scope="col" className="px-3 py-2">Carat</th>
                <th scope="col" className="px-3 py-2">Status</th>
                <th scope="col" className="px-3 py-2">Submitted</th>
                <th scope="col" className="px-3 py-2">Why it is here</th>
                <th scope="col" className="px-3 py-2">
                  <span className="sr-only">Open</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-stone-200 align-top">
                  <td className="px-3 py-2 font-mono text-xs">{row.reference}</td>
                  <td className="px-3 py-2">{row.gemstoneType}</td>
                  <td className="px-3 py-2">{formatCarat(row.caratMilli)}</td>
                  <td className="px-3 py-2">{statusLabel(row.status)}</td>
                  <td className="px-3 py-2">{formatDate(row.submittedAt)}</td>
                  <td className="px-3 py-2">
                    {row.expertReasons.length === 0 ? "-" : row.expertReasons.map((r) => expertReasonLabel(r)).join("; ")}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Link href={VALUATION_ROUTES.valuatorDetail(row.id)} className="underline">
                      Open<span className="sr-only"> {row.reference}</span>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
