import Link from "next/link";
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
    <section className="mx-auto max-w-4xl space-y-6 px-4 py-10 sm:px-6">
      <div>
        <p className="text-sm uppercase tracking-widest text-accent">Quotations</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">Quotations you have sent</h1>
        <p className="mt-2 text-sm text-ink-soft">
          Quotations are sent inside a conversation. Open the conversation to withdraw a quotation or download its PDF.
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line bg-surface-raised p-8 text-center">
          <h2 className="text-lg font-semibold text-ink">No quotations yet</h2>
          <p className="mt-2 text-sm text-ink-soft">Send a quotation from an enquiry or requirement conversation.</p>
        </div>
      ) : (
        <ul className="divide-y divide-line rounded-lg border border-line bg-surface-raised">
          {rows.map((row) => {
            const status = effectiveQuotationStatus(row, now);
            const buyer = row.conversation.participants.find((p) => p.userId !== user.id)?.user.name ?? "Buyer";
            return (
              <li key={row.id} className="space-y-2 px-4 py-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-ink">
                      {row.itemTitle}
                      {row.conversation.isDemo && (
                        <span className="ml-2 rounded bg-accent-soft px-1.5 py-0.5 text-xs font-normal text-ink">Demo</span>
                      )}
                    </p>
                    <p className="text-sm text-ink-soft">
                      {row.quantity} × {formatMoney(row.amountMinor, row.currency)} · {buyer}
                    </p>
                  </div>
                  <span className="rounded-full border border-line px-2.5 py-0.5 text-xs text-ink-soft">
                    {QUOTATION_STATUS_LABELS[status] ?? status}
                  </span>
                </div>
                <p className="text-xs text-ink-soft">
                  Valid until{" "}
                  {row.validUntil
                    ? row.validUntil.toLocaleDateString("en-IN", { dateStyle: "medium", timeZone: "UTC" })
                    : "not set"}{" "}
                  · Sent {row.createdAt.toLocaleDateString("en-IN", { dateStyle: "medium" })}
                </p>
                <div className="flex flex-wrap gap-4 text-sm">
                  <Link href={`/conversations/${row.conversationId}`} className="font-medium text-brand underline">
                    Open conversation
                  </Link>
                  <a
                    href={`/api/conversations/${row.conversationId}/quotations/${row.id}/pdf`}
                    className="font-medium text-brand underline"
                  >
                    Download PDF
                  </a>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
