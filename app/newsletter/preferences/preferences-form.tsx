"use client";

import { useActionState } from "react";
import { ResultMessage } from "@/components/newsletter/result-message";
import { TokenActionForm } from "@/components/newsletter/token-action-form";
import { TopicFieldset } from "@/components/newsletter/topic-fieldset";
import { unsubscribeAction } from "../unsubscribe/actions";
import { saveTopicsAction } from "./actions";

/** Topic form plus the "unsubscribe from everything" action. Both post the signed token. */
export function PreferencesForm({ token, topics }: { token: string; topics: string[] }) {
  const [result, formAction, pending] = useActionState(saveTopicsAction, null);
  return (
    <div className="space-y-10">
      <form action={formAction} className="space-y-5" aria-label="Your topics">
        <input type="hidden" name="token" value={token} />
        <TopicFieldset selected={topics} legend="Topics you receive" hint="Choose at least one topic. To stop all email, use the unsubscribe button below." idPrefix="pref" />
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-brand-strong px-5 py-2.5 font-medium text-white hover:opacity-90 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          {pending ? "Saving..." : "Save my topics"}
        </button>
        <ResultMessage result={result} />
      </form>

      <section aria-labelledby="unsub-heading" className="space-y-3 border-t border-line pt-8">
        <h2 id="unsub-heading" className="text-lg font-semibold text-ink">Unsubscribe from everything</h2>
        <p className="text-sm text-ink-soft">You will stop receiving all newsletter email. You can sign up again at any time.</p>
        <TokenActionForm action={unsubscribeAction} token={token} label="Unsubscribe from everything" tone="danger" />
      </section>
    </div>
  );
}
