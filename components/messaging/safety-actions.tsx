"use client";

import { useState, useTransition } from "react";
import { blockConversationAction, reportConversationAction } from "@/app/conversations/actions";

const REASONS = [
  { value: "SPAM", label: "Spam or unwanted messages" },
  { value: "SCAM", label: "Scam or payment request" },
  { value: "HARASSMENT", label: "Harassment or abuse" },
  { value: "FAKE_LISTING", label: "Misleading listing or identity" },
  { value: "OTHER", label: "Something else" },
] as const;

/** Block and report for one conversation. Both go through server actions that re-check membership. */
export function SafetyActions({ conversationId, blocked }: { conversationId: string; blocked: boolean }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function block() {
    if (!window.confirm("Block this person? They will not be able to message you, and you will not be able to message them.")) return;
    startTransition(async () => {
      const result = await blockConversationAction(conversationId);
      setMessage(result.ok ? "Blocked. You will not receive messages from this person." : result.error);
    });
  }

  function report(formData: FormData) {
    startTransition(async () => {
      const result = await reportConversationAction(conversationId, formData);
      setMessage(result.ok ? "Thank you. Our team will review this report." : result.error);
      if (result.ok) setOpen(false);
    });
  }

  return (
    <div className="flex flex-col items-end gap-2 text-sm">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className=" border border-line min-h-11 px-4 py-2.5 text-ink-soft hover:text-ink"
          aria-expanded={open}
        >
          Report
        </button>
        {!blocked && (
          <button
            type="button"
            onClick={block}
            disabled={pending}
            className=" border border-line min-h-11 px-4 py-2.5 text-ink-soft hover:text-ink disabled:opacity-50"
          >
            Block
          </button>
        )}
      </div>
      {message && <p role="status" className="text-ink-soft">{message}</p>}
      {open && (
        <form action={report} className="w-full max-w-xs border border-line bg-surface-raised p-4 text-left sm:w-72">
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 font-medium text-ink">Why are you reporting this?</legend>
            {REASONS.map((r) => (
              <label key={r.value} className="flex items-center gap-2 text-ink">
                <input type="radio" name="reason" value={r.value} required />
                {r.label}
              </label>
            ))}
          </fieldset>
          <label className="mt-3 block text-ink">
            <span className="text-ink-soft">Details (optional)</span>
            <textarea name="details" maxLength={1000} rows={3} className="mt-1 block w-full border border-line bg-surface-raised px-4 py-3 text-[15px] focus:border-accent focus:outline-none" />
          </label>
          <button type="submit" disabled={pending} className="mt-3 bg-brand min-h-11 px-4 py-2.5 text-ivory disabled:opacity-50">
            Send report
          </button>
        </form>
      )}
    </div>
  );
}
