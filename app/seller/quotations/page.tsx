import Link from "next/link";
import { FileText } from "lucide-react";
import { Badge, DemoTag } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Suspense } from "react";
import { AwaitingApprovalPage } from "@/components/seller/seller-pages";
import { requireRole } from "@/lib/auth/require-role";
import { expireStaleQuotationsForSeller } from "@/lib/quotations/service";
import { effectiveQuotationStatus, formatMoney, QUOTATION_STATUS_LABELS } from "@/lib/quotations/validate";
import { prisma } from "@/lib/db/client";
import { gateApprovedSeller } from "@/lib/seller/approved-gate";

export default function SellerQuotationsPage() {
  return (
    <Suspense fallback={null}>
      <SellerQuotations />
    </Suspense>
  );
}

async function SellerQuotations() {
  const state = await gateApprovedSeller();
  if (state !== "approved") return <AwaitingApprovalPage title="Quotations" />;

  const user = await requireRole(["SELLER"], { sellerApproved: true });
  const now = new Date();
  await expireStaleQuotationsForSeller(user.id, now);

  const rows = await prisma.quotation.findMany({
    where: { sellerId: user.id },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      conversationId: true,
      itemTitle: true,
      quantity: true,
      amountMinor: true,
      currency: true,
      validUntil: true,
      status: true,
      createdAt: true,
      conversation: {
        select: {
          isDemo: true,
          participants: { select: { userId: true, user: { select: { name: true } } } },
        },
      },
    },
  });

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <p className="text-[11px] uppercase tracking-[0.28em] text-accent-text">Quotations</p>
        <h1 className="mt-2 font-heading text-4xl text-ink">Quotations you have sent</h1>
        <p className="mt-2 text-sm text-ink-soft">
          Quotations are sent inside a conversation. Open the conversation to withdraw a quotation or download its PDF.
        </p>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No quotations yet"
          body="Send a quotation from an enquiry or requirement conversation."
          action={
            <ButtonLink href="/seller/inbox" variant="secondary">
              Open your inbox
            </ButtonLink>
          }
        />
      ) : (
        <ul className="divide-y divide-line border border-line bg-surface-raised">
          {rows.map((row) => {
            const status = effectiveQuotationStatus(row, now);
            const buyer = row.conversation.participants.find((p) => p.userId !== user.id)?.user.name ?? "Buyer";
            return (
              <li key={row.id} className="space-y-3 px-4 py-5 sm:px-6">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-heading text-xl text-ink">
                      {row.itemTitle}
                      {row.conversation.isDemo && (
                        <DemoTag />
                      )}
                    </p>
                    <p className="text-sm text-ink-soft">
                      {row.quantity} × {formatMoney(row.amountMinor, row.currency)} · {buyer}
                    </p>
                  </div>
                  <Badge tone={status === "ACCEPTED" ? "success" : status === "DECLINED" || status === "WITHDRAWN" || status === "EXPIRED" ? "danger" : "neutral"}>
                    {QUOTATION_STATUS_LABELS[status] ?? status}
                  </Badge>
                </div>
                <p className="text-xs text-ink-soft">
                  Valid until{" "}
                  {row.validUntil
                    ? row.validUntil.toLocaleDateString("en-IN", { dateStyle: "medium", timeZone: "UTC" })
                    : "not set"}{" "}
                  · Sent {row.createdAt.toLocaleDateString("en-IN", { dateStyle: "medium" })}
                </p>
                <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
                  <Link href={`/conversations/${row.conversationId}`} className="inline-flex min-h-11 items-center font-medium text-ink underline underline-offset-4 hover:text-accent-text">
                    Open conversation
                  </Link>
                  <a
                    href={`/api/conversations/${row.conversationId}/quotations/${row.id}/pdf`}
                    className="inline-flex min-h-11 items-center font-medium text-ink underline underline-offset-4 hover:text-accent-text"
                  >
                    Download PDF
                  </a>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
