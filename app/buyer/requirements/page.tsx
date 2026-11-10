import Link from "next/link";
import { Suspense } from "react";
import { ClipboardList, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { requirePageRole } from "@/lib/auth/require-role";
import { formatBudgetRange, formatCaratRange } from "@/lib/requirements/format";
import { listRequirementsForBuyer } from "@/lib/requirements/service";

export default function RequirementsPage() {
  return (
    <Suspense fallback={null}>
      <RequirementList />
    </Suspense>
  );
}

async function RequirementList() {
  const user = await requirePageRole(["BUYER"]);
  const rows = await listRequirementsForBuyer(user.id);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="space-y-2">
          <h2 className="font-heading text-3xl text-ink">Your requirements</h2>
          <p className="text-sm text-ink-soft">Approved sellers in matching categories are notified when you post one.</p>
        </div>
        <ButtonLink href="/buyer/requirements/new" variant="gold">
          <Plus className="h-4 w-4" strokeWidth={1.25} aria-hidden />
          Post a requirement
        </ButtonLink>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="You have not posted a requirement yet"
          body="Describe the stone you need and sellers can respond to you on the platform."
          action={
            <ButtonLink href="/buyer/requirements/new" variant="secondary">
              Post a requirement
            </ButtonLink>
          }
        />
      ) : (
        <ul className="divide-y divide-line border border-line bg-surface-raised">
          {rows.map((row) => {
            const facts = [
              row.category?.name ?? "Any category",
              formatCaratRange(row.caratMin, row.caratMax),
              formatBudgetRange(row.budgetMinMinor, row.budgetMaxMinor, row.currency),
              `Qty ${row.quantity}`,
            ].filter(Boolean);
            return (
              <li key={row.id}>
                <Link
                  href={`/buyer/requirements/${row.id}`}
                  className="flex min-h-[4.5rem] items-start justify-between gap-4 px-4 py-4 transition duration-300 hover:bg-accent-soft/40 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent sm:px-6"
                >
                  <div className="min-w-0 space-y-1.5">
                    <p className="font-heading text-xl text-ink">{row.gemstoneType}</p>
                    <p className="text-sm text-ink-soft">{facts.join(" · ")}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2 text-xs text-ink-soft">
                    <Badge tone={row.status === "OPEN" ? "success" : "neutral"}>{row.status === "OPEN" ? "Open" : "Closed"}</Badge>
                    <span className="tabular-nums">
                      {row._count.responses} {row._count.responses === 1 ? "response" : "responses"}
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
