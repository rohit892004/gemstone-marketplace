"use client";

import { useActionState, useEffect, useId, useRef } from "react";
import { answerInfoAction } from "@/app/valuation/actions";
import { THREAD_LABEL } from "@/lib/valuation/requester-copy";
import { ErrorSummary, Field, inputClass, primaryButtonClass } from "./ui";
import type { ThreadEntry } from "@/lib/valuation/view";

/** The conversation between the valuer and the requester, shown in order. Authors are named by role only. */
export function ThreadList({ thread }: { thread: ThreadEntry[] }) {
  const entries = thread.filter((t) => t.kind in THREAD_LABEL);
  if (entries.length === 0) return <p className="text-sm text-ink-soft">No messages yet.</p>;
  return (
    <ol className="space-y-3">
      {entries.map((entry) => (
        <li key={entry.id} className="border border-line bg-surface px-4 py-3 text-sm">
          <p className="font-medium text-ink">{THREAD_LABEL[entry.kind]}</p>
          <p className="mt-1 whitespace-pre-line text-ink">{entry.body}</p>
          <p className="mt-2 text-xs text-ink-soft">
            {entry.createdAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}
          </p>
        </li>
      ))}
    </ol>
  );
}

/** Reply form for the valuer's open question. The server checks that a question is open and that the text is clean. */
export function InfoReplyForm({ valuationId }: { valuationId: string }) {
  const ids = useId();
  const [state, formAction, pending] = useActionState(answerInfoAction, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  const replyError = state && !state.ok && state.field === "reply" ? state.error : undefined;
  const summary = state && !state.ok && !replyError ? [state.error] : replyError ? [replyError] : [];

  return (
    <form ref={formRef} action={formAction} className="space-y-4" aria-label="Reply to the valuer">
      <input type="hidden" name="valuationId" value={valuationId} />
      <ErrorSummary messages={summary} title="Your reply was not sent" />
      {state && state.ok && state.message ? (
        <p role="status" className="text-sm text-ink-soft">
          {state.message}
        </p>
      ) : null}
      <Field id={`${ids}-body`} label="Your reply" required error={undefined} hint="Up to 1000 characters. Do not include phone numbers, email addresses or links.">
        <textarea id={`${ids}-body`} name="body" rows={4} maxLength={1000} required className={inputClass} aria-invalid={replyError ? true : undefined} />
      </Field>
      <button type="submit" disabled={pending} className={primaryButtonClass}>
        {pending ? "Sending..." : "Send reply"}
      </button>
    </form>
  );
}
