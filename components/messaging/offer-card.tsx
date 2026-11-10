"use client";

import { useState, useTransition } from "react";
import {
  acceptOfferAction,
  counterOfferAction,
  declineOfferAction,
} from "@/app/conversations/offer-respond-actions";
import { formatMoney } from "@/lib/quotations/validate";
import type { OfferPayload, ThreadContext } from "./types";

/**
 * Offer card under a message. The non-proposer can accept, decline or counter while the offer is PENDING.
 * The note is plain text (React escapes it). Status changes made here update this card at once. The other
 * party's card updates on reload, because the thread poll only adds new messages.
 */

const STATUS_LABELS: Record<OfferPayload["status"], string> = {
  PENDING: "Awaiting response",
  ACCEPTED: "Accepted",
  DECLINED: "Declined",
  COUNTERED: "Countered",
  WITHDRAWN: "Withdrawn",
};

export function OfferCard({ offer, context }: { offer: OfferPayload; context: ThreadContext }) {
  const [status, setStatus] = useState(offer.status);
  const [showCounter, setShowCounter] = useState(false);
  const [counterAmount, setCounterAmount] = useState("");
  const [counterNote, setCounterNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const isProposer = offer.proposerId === context.viewerId;
  const canRespond = status === "PENDING" && !isProposer;
  const amount = formatMoney(offer.amountMinor, offer.currency);

  function decide(action: typeof acceptOfferAction, label: string) {
    setError(null);
    startTransition(async () => {
      const result = await action(offer.id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setStatus(result.status);
      setNotice(label);
    });
  }

  function counter() {
    setError(null);
    const form = new FormData();
    form.set("amount", counterAmount);
    form.set("note", counterNote);
    startTransition(async () => {
      const result = await counterOfferAction(offer.id, form);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setStatus("COUNTERED");
      setShowCounter(false);
      setNotice(result.warning ?? "Counter offer sent.");
    });
  }

  return (
    <div className="mt-3 space-y-2 border border-line bg-surface-raised p-4 text-ink sm:p-5">
      <p className="text-[11px] uppercase tracking-[0.2em] text-accent-text">{offer.counterOfId ? "Counter offer" : "Offer"}</p>
      <p className="font-heading text-2xl text-ink">{amount}</p>
      {offer.note && <p className="mt-1 whitespace-pre-wrap break-words text-sm text-ink-soft">{offer.note}</p>}
      <p className="mt-2 text-sm">
        <span className="text-ink-soft">Status: </span>
        {STATUS_LABELS[status]}
      </p>

      {canRespond && !showCounter && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => decide(acceptOfferAction, "Offer accepted.")}
            className=" bg-brand min-h-11 px-4 py-2.5 text-sm font-medium text-ivory hover:bg-brand-strong disabled:opacity-50"
          >
            Accept
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => setShowCounter(true)}
            className=" border border-brand min-h-11 px-4 py-2.5 text-sm font-medium text-ink hover:bg-accent-soft/40 disabled:opacity-50"
          >
            Counter
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => decide(declineOfferAction, "Offer declined.")}
            className=" border border-brand min-h-11 px-4 py-2.5 text-sm font-medium text-ink hover:bg-accent-soft/40 disabled:opacity-50"
          >
            Decline
          </button>
        </div>
      )}

      {canRespond && showCounter && (
        <form
          className="mt-3 flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            counter();
          }}
        >
          <label className="text-sm text-ink-soft" htmlFor={`counter-amount-${offer.id}`}>
            Your counter amount ({offer.currency})
          </label>
          <input
            id={`counter-amount-${offer.id}`}
            value={counterAmount}
            onChange={(e) => setCounterAmount(e.target.value)}
            inputMode="decimal"
            placeholder="e.g. 115000"
            required
            className="w-full border border-line bg-surface px-4 py-3 text-[15px] text-ink focus:border-accent focus:outline-none"
          />
          <label className="text-sm text-ink-soft" htmlFor={`counter-note-${offer.id}`}>
            Note (optional)
          </label>
          <textarea
            id={`counter-note-${offer.id}`}
            value={counterNote}
            onChange={(e) => setCounterNote(e.target.value)}
            maxLength={500}
            rows={2}
            className="w-full border border-line bg-surface px-4 py-3 text-[15px] text-ink focus:border-accent focus:outline-none"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={pending || counterAmount.trim().length === 0}
              className=" bg-brand min-h-11 px-4 py-2.5 text-sm font-medium text-ivory hover:bg-brand-strong disabled:opacity-50"
            >
              {pending ? "Sending..." : "Send counter"}
            </button>
            <button
              type="button"
              onClick={() => setShowCounter(false)}
              className=" min-h-11 px-4 py-2.5 text-sm text-ink-soft hover:text-ink"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {notice && <p role="status" className="mt-2 text-sm text-ink-soft">{notice}</p>}
      {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
    </div>
  );
}
