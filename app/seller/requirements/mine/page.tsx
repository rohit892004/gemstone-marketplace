import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
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
    <div className="max-w-3xl space-y-6">
      <PageHeader
        eyebrow="Buying"
        title="Your requirements"
        lead="Requirements you post as a buyer. Sellers who respond open a conversation in your inbox."
        actions={
          <ButtonLink href="/seller/requirements/new" variant="gold">
            Post a requirement
          </ButtonLink>
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="You have not posted a requirement yet"
          body="Looking for a stone from another seller? Post it here."
          action={
            <ButtonLink href="/seller/requirements/new" variant="secondary">
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
              <li key={row.id} className="flex flex-wrap items-start justify-between gap-4 px-4 py-5 sm:px-6">
                <div className="min-w-0 space-y-1">
                  <p className="font-heading text-xl text-ink">{row.gemstoneType}</p>
                  <p className="text-sm text-ink-soft">{facts.join(" · ")}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2 text-xs text-ink-soft">
                  <Badge tone={row.status === "OPEN" ? "success" : "neutral"}>{row.status === "OPEN" ? "Open" : "Closed"}</Badge>
                  <span>
                    {row._count.responses} {row._count.responses === 1 ? "response" : "responses"}
                  </span>
                  {row.status === "OPEN" && (
                    <Link href={`/seller/requirements/mine/${row.id}/edit`} className="inline-flex min-h-11 items-center text-sm font-medium text-ink underline underline-offset-4 hover:text-accent-text">
                      Edit
                    </Link>
                  )}
                  {row.status === "OPEN" && <CloseRequirementButton requirementId={row.id} />}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
