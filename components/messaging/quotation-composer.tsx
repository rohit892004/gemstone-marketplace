"use client";

import { useState, useTransition, type FormEvent } from "react";
import { createQuotationAction } from "@/app/conversations/quote-actions";
import { QUANTITY_MAX, QUANTITY_MIN, TERMS_MAX, ITEM_TITLE_MAX } from "@/lib/quotations/validate";
import type { ThreadContext } from "./types";

/**
 * Seller's quotation composer. Shown in enquiry and requirement threads only (not general chats, and not
 * once the requirement is closed). The form is collapsed by default to keep the thread compact.
 * Validation runs on the server. The client only sets sensible limits.
 */
export function QuotationComposer({ context }: { context: ThreadContext }) {
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [minDate] = useState(() => new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10));

  if (context.kind === "GENERAL") return null;
  if (context.requirement?.status === "CLOSED") return null;

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await createQuotationAction(context.conversationId, data);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      form.reset();
      form.closest("details")?.removeAttribute("open");
      setNotice(result.warning ?? "Quotation sent. The buyer can accept or decline it in this conversation.");
    });
  }

  return (
    <details className="rounded-md border border-line bg-surface px-3 py-2 text-ink">
      <summary className="cursor-pointer text-sm font-medium text-brand">Send a quotation</summary>
      <form onSubmit={onSubmit} className="mt-3 grid gap-3 sm:grid-cols-2">
        {context.gemstone && <input type="hidden" name="gemstoneId" value={context.gemstone.id} />}
        <div className="sm:col-span-2">
          <label htmlFor="quote-item" className="block text-sm text-ink-soft">
            Item
          </label>
          <input
            id="quote-item"
            name="itemTitle"
            required
            maxLength={ITEM_TITLE_MAX}
            defaultValue={context.gemstone?.title ?? ""}
            placeholder="Gemstone or custom item"
            className="mt-1 w-full rounded-md border border-line bg-surface-raised px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="quote-quantity" className="block text-sm text-ink-soft">
            Quantity
          </label>
          <input
            id="quote-quantity"
            name="quantity"
            type="number"
            inputMode="numeric"
            min={QUANTITY_MIN}
            max={QUANTITY_MAX}
            step={1}
            defaultValue={1}
            required
            className="mt-1 w-full rounded-md border border-line bg-surface-raised px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="quote-amount" className="block text-sm text-ink-soft">
            Price
          </label>
          <div className="mt-1 flex gap-2">
            <select
              id="quote-currency"
              name="currency"
              defaultValue="INR"
              aria-label="Currency"
              className="rounded-md border border-line bg-surface-raised px-2 py-2 text-sm text-ink focus:border-brand focus:outline-none"
            >
              <option value="INR">INR</option>
              <option value="USD">USD</option>
            </select>
            <input
              id="quote-amount"
              name="amount"
              inputMode="decimal"
              required
              placeholder="e.g. 125000.00"
              className="w-full rounded-md border border-line bg-surface-raised px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none"
            />
          </div>
        </div>
        <div>
          <label htmlFor="quote-valid" className="block text-sm text-ink-soft">
            Valid until
          </label>
          <input
            id="quote-valid"
            name="validUntil"
            type="date"
            min={minDate}
            required
            className="mt-1 w-full rounded-md border border-line bg-surface-raised px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none"
          />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="quote-terms" className="block text-sm text-ink-soft">
            Terms (optional)
          </label>
          <textarea
            id="quote-terms"
            name="terms"
            rows={3}
            maxLength={TERMS_MAX}
            placeholder="Payment, delivery, certification or return terms. Contact details are hidden automatically."
            className="mt-1 w-full rounded-md border border-line bg-surface-raised px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none"
          />
        </div>
        <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-strong disabled:opacity-50"
          >
            {pending ? "Sending..." : "Send quotation"}
          </button>
          <p className="text-xs text-ink-soft">Payments are not taken on the platform. Agree payment with the buyer here.</p>
        </div>
        {notice && <p role="status" className="sm:col-span-2 text-sm text-ink">{notice}</p>}
        {error && <p role="alert" className="sm:col-span-2 text-sm text-red-700">{error}</p>}
      </form>
    </details>
  );
}
