import { Suspense } from "react";
import { BarChart3, ListChecks } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
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
    <div className="border border-line bg-surface-raised p-4">
      <p className="text-[11px] uppercase tracking-[0.18em] text-ink-soft">{label}</p>
      <p className="mt-1 font-heading text-4xl font-medium text-ink">{value}</p>
      {note ? <p className="mt-1 text-[12px] text-ink-soft">{note}</p> : null}
    </div>
  );
}

async function Stats() {
  const admin = await requirePageRole(["ADMIN"]);
  const stats = await loadValuationStats({ id: admin.id });
  const total = stats.statusCounts.reduce((sum, row) => sum + row.count, 0);

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-4xl font-medium text-ink">Valuation stats</h1>
      <p className="text-sm text-ink-soft">Counts include demo data until it is removed.</p>

      <section aria-labelledby="volume-heading" className="space-y-3">
        <h2 id="volume-heading" className="font-heading text-2xl text-ink">Volume</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Card label="All requests" value={String(total)} />
          <Card label="New in last 7 days" value={String(stats.newLast7Days)} />
          <Card label="New in last 30 days" value={String(stats.newLast30Days)} />
          <Card label="Average hours to expert sign-off" value={stats.averageExpertHours === null ? "-" : String(stats.averageExpertHours)} note="From submission to sign-off" />
        </div>
      </section>

      <section aria-labelledby="status-heading" className="space-y-3">
        <h2 id="status-heading" className="font-heading text-2xl text-ink">By status</h2>
        {stats.statusCounts.length === 0 ? (
          <EmptyState icon={BarChart3} title="No requests yet" body="Counts appear here once valuation requests arrive." />
        ) : (
          <div className="relative overflow-x-auto border border-line bg-surface-raised">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Requests by status</caption>
              <thead className="bg-surface text-[11px] uppercase tracking-[0.18em] text-ink-soft">
                <tr>
                  <th scope="col" className="px-3 py-2">Status</th>
                  <th scope="col" className="px-3 py-2 text-right">Requests</th>
                </tr>
              </thead>
              <tbody>
                {stats.statusCounts.map((row) => (
                  <tr key={row.status} className="border-t border-line">
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
        <h2 id="completions-heading" className="font-heading text-2xl text-ink">Completed by</h2>
        <div className="grid grid-cols-2 gap-3">
          <Card label="Automatic" value={String(stats.autoCompletions)} note="Rule engine results" />
          <Card label="Expert" value={String(stats.expertCompletions)} note="Valuer sign-offs" />
        </div>
      </section>

      <section aria-labelledby="open-heading" className="space-y-3">
        <h2 id="open-heading" className="font-heading text-2xl text-ink">Open requests per valuer</h2>
        {stats.openPerValuator.length === 0 ? (
          <EmptyState icon={ListChecks} title="No open requests" body="Every valuer is clear for now." />
        ) : (
          <ul className="divide-y divide-line border border-line bg-surface-raised text-sm">
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
