"use client";

import { useId, useRef, useState, useTransition } from "react";
import { sendOfferAction } from "@/app/conversations/offer-actions";

/**
 * Buyer's offer form, shown above the message box in a listing enquiry. The server re-checks
 * everything (role, membership, pending offer, listing visibility). This component only renders the result.
 * Plain text only: no HTML is rendered from user input.
 */
export function OfferComposer({ conversationId }: { conversationId: string }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const ids = useId();

  function submit(form: HTMLFormElement) {
    setError(null);
    setNotice(null);
    const data = new FormData(form);
    startTransition(async () => {
      const result = await sendOfferAction(conversationId, data);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      formRef.current?.reset();
      setOpen(false);
      setNotice(
        result.warning
          ? `Offer sent. ${result.warning}`
          : "Offer sent. The seller will reply in this conversation.",
      );
    });
  }

  return (
    <div className="space-y-2">
      {notice ? (
        <p role="status" className=" bg-accent-soft px-3 py-2 text-sm text-ink">
          {notice}
        </p>
      ) : null}
      {open ? (
        <form
          ref={formRef}
          noValidate
          aria-label="Make an offer"
          className="space-y-3 border border-line bg-surface p-3"
          onSubmit={(e) => {
            e.preventDefault();
            submit(e.currentTarget);
          }}
        >
          <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
            <div className="space-y-1">
              <label htmlFor={`${ids}-amount`} className="block text-sm font-medium text-ink">
                Offer amount
              </label>
              <input
                id={`${ids}-amount`}
                name="amount"
                inputMode="decimal"
                placeholder="For example 12,500"
                required
                className="block w-full border border-line bg-surface-raised px-4 py-3 text-[15px] text-ink focus:border-accent focus:outline-none"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor={`${ids}-currency`} className="block text-sm font-medium text-ink">
                Currency
              </label>
              <select
                id={`${ids}-currency`}
                name="currency"
                defaultValue="INR"
                className="block w-full border border-line bg-surface-raised px-4 py-3 text-[15px] text-ink focus:border-accent focus:outline-none"
              >
                <option value="INR">INR</option>
                <option value="USD">USD</option>
              </select>
            </div>
          </div>
          <div className="space-y-1">
            <label htmlFor={`${ids}-note`} className="block text-sm font-medium text-ink">
              Note <span className="font-normal text-ink-soft">(optional)</span>
            </label>
            <textarea
              id={`${ids}-note`}
              name="note"
              rows={2}
              maxLength={500}
              placeholder="Terms or conditions for this offer"
              className="block w-full border border-line bg-surface-raised px-4 py-3 text-[15px] text-ink focus:border-accent focus:outline-none"
            />
          </div>
          <p className="text-xs text-ink-soft">
            Offers are not payments. The seller can accept, decline or counter in this conversation.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={pending}
              className=" bg-brand px-4 py-2 text-sm font-medium text-ivory hover:bg-brand-strong disabled:opacity-50"
            >
              {pending ? "Sending offer..." : "Send offer"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className=" px-3 py-2 text-sm text-ink-soft hover:text-ink"
            >
              Cancel
            </button>
          </div>
          {error ? (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null}
        </form>
      ) : (
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            setNotice(null);
          }}
          aria-expanded={open}
          className=" border border-brand min-h-11 px-4 py-2.5 text-sm font-medium text-brand-strong hover:bg-accent-soft"
        >
          Make an offer
        </button>
      )}
    </div>
  );
}
