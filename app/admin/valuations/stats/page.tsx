import { Suspense } from "react";
import { requirePageRole } from "@/lib/auth/require-role";
import { loadValuationStats } from "@/lib/valuation/admin-stats";
import { statusLabel } from "@/lib/valuation/display";

export const metadata = { title: "Valuation stats" };

export default function ValuationStatsPage() {
  return (
    <Suspense fallback={null}>
      <Stats />
    </Suspense>
  );
}

function Card({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded border border-stone-300 bg-white p-4">
      <p className="text-xs uppercase tracking-wide text-stone-600">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
      {note ? <p className="mt-1 text-xs text-stone-600">{note}</p> : null}
    </div>
  );
}

async function Stats() {
  await requirePageRole(["ADMIN"]);
  const stats = await loadValuationStats();
  const total = stats.statusCounts.reduce((sum, row) => sum + row.count, 0);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Valuation stats</h1>
      <p className="text-sm text-stone-600">Counts include demo data until it is removed.</p>

      <section aria-labelledby="volume-heading" className="space-y-3">
        <h2 id="volume-heading" className="text-lg font-medium">Volume</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Card label="All requests" value={String(total)} />
          <Card label="New in last 7 days" value={String(stats.newLast7Days)} />
          <Card label="New in last 30 days" value={String(stats.newLast30Days)} />
          <Card label="Average hours to expert sign-off" value={stats.averageExpertHours === null ? "-" : String(stats.averageExpertHours)} note="From submission to sign-off" />
        </div>
      </section>

      <section aria-labelledby="status-heading" className="space-y-3">
        <h2 id="status-heading" className="text-lg font-medium">By status</h2>
        {stats.statusCounts.length === 0 ? (
          <p className="text-sm text-stone-600">No requests yet.</p>
        ) : (
          <div className="overflow-x-auto rounded border border-stone-300 bg-white">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Requests by status</caption>
              <thead className="bg-stone-100 text-xs uppercase tracking-wide text-stone-600">
                <tr>
                  <th scope="col" className="px-3 py-2">Status</th>
                  <th scope="col" className="px-3 py-2 text-right">Requests</th>
                </tr>
              </thead>
              <tbody>
                {stats.statusCounts.map((row) => (
                  <tr key={row.status} className="border-t border-stone-200">
                    <td className="px-3 py-2">{statusLabel(row.status)}</td>
                    <td className="px-3 py-2 text-right">{row.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="completions-heading" className="space-y-3">
        <h2 id="completions-heading" className="text-lg font-medium">Completed by</h2>
        <div className="grid grid-cols-2 gap-3">
          <Card label="Automatic" value={String(stats.autoCompletions)} note="Rule engine results" />
          <Card label="Expert" value={String(stats.expertCompletions)} note="Valuer sign-offs" />
        </div>
      </section>

      <section aria-labelledby="open-heading" className="space-y-3">
        <h2 id="open-heading" className="text-lg font-medium">Open requests per valuer</h2>
        {stats.openPerValuator.length === 0 ? (
          <p className="text-sm text-stone-600">No open requests.</p>
        ) : (
          <ul className="divide-y divide-stone-200 rounded border border-stone-300 bg-white text-sm">
            {stats.openPerValuator.map((row) => (
              <li key={row.valuatorId ?? "none"} className="flex justify-between px-3 py-2">
                <span>{row.name}</span>
                <span className="font-medium">{row.count}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
