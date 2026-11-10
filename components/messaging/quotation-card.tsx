"use client";

import { useState, useTransition } from "react";
import {
  acceptQuotationAction,
  declineQuotationAction,
  withdrawQuotationAction,
} from "@/app/conversations/quote-actions";
import { effectiveQuotationStatus, formatMoney, isQuotationExpired, QUOTATION_STATUS_LABELS } from "@/lib/quotations/validate";
import type { QuotationPayload, ThreadContext } from "./types";

/**
 * Quotation card under a message. The buyer side can accept or decline while SENT and not expired.
 * The seller can withdraw while SENT. Expired is computed from validUntil, so it shows even before
 * the server has stored EXPIRED. The PDF link is served by an authorised route.
 */
export function QuotationCard({
  quotation,
  context,
}: {
  quotation: QuotationPayload;
  context: ThreadContext;
}) {
  const [status, setStatus] = useState(quotation.status);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [now] = useState(() => new Date());

  const validUntil = quotation.validUntil ? new Date(quotation.validUntil) : null;
  const shownStatus = effectiveQuotationStatus({ status, validUntil }, now);
  const open = shownStatus === "SENT" && !isQuotationExpired({ status, validUntil }, now);
  const isSeller = quotation.sellerId === context.viewerId;
  const canAnswer = open && !isSeller;
  const canWithdraw = open && isSeller;
  const pdfHref = `/api/conversations/${context.conversationId}/quotations/${quotation.id}/pdf`;

  function run(action: (id: string) => Promise<{ ok: true; status?: string } | { ok: false; error: string }>, next: string) {
    setError(null);
    startTransition(async () => {
      const result = await action(quotation.id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setStatus(next as QuotationPayload["status"]);
    });
  }

  return (
    <div className="mt-3 space-y-2 border border-line bg-surface-raised p-4 text-ink sm:p-5">
      <p className="text-[11px] uppercase tracking-[0.2em] text-accent-text">Quotation</p>
      <p className="break-words font-heading text-2xl text-ink">{quotation.itemTitle}</p>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="text-ink-soft">Quantity</dt>
        <dd>{quotation.quantity}</dd>
        <dt className="text-ink-soft">Price</dt>
        <dd>{formatMoney(quotation.amountMinor, quotation.currency)}</dd>
        <dt className="text-ink-soft">Valid until</dt>
        <dd>
          {validUntil
            ? validUntil.toLocaleDateString("en-IN", { dateStyle: "medium", timeZone: "UTC" })
            : "No date set"}
        </dd>
        <dt className="text-ink-soft">Status</dt>
        <dd>{QUOTATION_STATUS_LABELS[shownStatus] ?? shownStatus}</dd>
      </dl>
      {quotation.terms && <p className="mt-2 whitespace-pre-wrap break-words text-sm text-ink-soft">{quotation.terms}</p>}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {canAnswer && (
          <>
            <button
              type="button"
              disabled={pending}
              onClick={() => run(acceptQuotationAction, "ACCEPTED")}
              className=" bg-brand min-h-11 px-4 py-2.5 text-sm font-medium text-ivory hover:bg-brand-strong disabled:opacity-50"
            >
              Accept
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => run(declineQuotationAction, "DECLINED")}
              className=" border border-brand min-h-11 px-4 py-2.5 text-sm font-medium text-ink hover:bg-accent-soft/40 disabled:opacity-50"
            >
              Decline
            </button>
          </>
        )}
        {canWithdraw && (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(withdrawQuotationAction, "WITHDRAWN")}
            className=" border border-brand min-h-11 px-4 py-2.5 text-sm font-medium text-ink hover:bg-accent-soft/40 disabled:opacity-50"
          >
            Withdraw
          </button>
        )}
        <a href={pdfHref} className="ml-auto text-sm font-medium text-ink underline underline-offset-4">
          Download PDF
        </a>
      </div>
      {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
    </div>
  );
}
