import Link from "next/link";
import { Suspense } from "react";
import { CloseRequirementButton } from "@/components/requirements/close-requirement-button";
import { AwaitingApprovalPage } from "@/components/seller/seller-pages";
import { requireRole } from "@/lib/auth/require-role";
import { formatBudgetRange, formatCaratRange } from "@/lib/requirements/format";
import { listRequirementsForBuyer } from "@/lib/requirements/service";
import { gateApprovedSeller } from "@/lib/seller/approved-gate";

/** Requirements this seller has posted as a buyer. Responses appear in the inbox under Buying. */
export default function SellerOwnRequirementsPage() {
  return (
    <Suspense fallback={null}>
      <OwnRequirements />
    </Suspense>
  );
}

async function OwnRequirements() {
  const state = await gateApprovedSeller();
  if (state !== "approved") return <AwaitingApprovalPage title="Your requirements" />;
  const user = await requireRole(["SELLER"], { sellerApproved: true });
  const rows = await listRequirementsForBuyer(user.id);

  return (
    <section className="mx-auto max-w-3xl space-y-6 px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <p className="text-sm uppercase tracking-widest text-accent">Buying</p>
          <h1 className="text-3xl font-semibold tracking-tight text-ink">Your requirements</h1>
          <p className="text-sm text-ink-soft">Requirements you post as a buyer. Sellers who respond open a conversation in your inbox.</p>
        </div>
        <Link href="/seller/requirements/new" className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-strong">
          Post a requirement
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line bg-surface-raised p-8 text-center">
          <h2 className="text-lg font-semibold text-ink">You have not posted a requirement yet</h2>
          <p className="mt-2 text-sm text-ink-soft">Looking for a stone from another seller? Post it here.</p>
        </div>
      ) : (
        <ul className="divide-y divide-line rounded-lg border border-line bg-surface-raised">
          {rows.map((row) => {
            const facts = [
              row.category?.name ?? "Any category",
              formatCaratRange(row.caratMin, row.caratMax),
              formatBudgetRange(row.budgetMinMinor, row.budgetMaxMinor, row.currency),
              `Qty ${row.quantity}`,
            ].filter(Boolean);
            return (
              <li key={row.id} className="flex flex-wrap items-start justify-between gap-4 px-4 py-4">
                <div className="min-w-0 space-y-1">
                  <p className="font-medium text-ink">{row.gemstoneType}</p>
                  <p className="text-sm text-ink-soft">{facts.join(" · ")}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2 text-xs text-ink-soft">
                  <span
                    className={
                      row.status === "OPEN"
                        ? "rounded-full bg-accent-soft px-2 py-0.5 font-medium text-brand-strong"
                        : "rounded-full border border-line px-2 py-0.5"
                    }
                  >
                    {row.status === "OPEN" ? "Open" : "Closed"}
                  </span>
                  <span>
                    {row._count.responses} {row._count.responses === 1 ? "response" : "responses"}
                  </span>
                  {row.status === "OPEN" && <CloseRequirementButton requirementId={row.id} />}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
