"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { ResultMessage } from "@/components/newsletter/result-message";
import { TokenActionForm } from "@/components/newsletter/token-action-form";
import { TopicFieldset } from "@/components/newsletter/topic-fieldset";
import { preferenceState } from "@/lib/newsletter/topics";
import { unsubscribeAction } from "../unsubscribe/actions";
import { saveTopicsAction } from "./actions";

/** Topic form plus the "unsubscribe from everything" action. Both post the signed token. */
export function PreferencesForm({ token, topics }: { token: string; topics: string[] }) {
  const [result, formAction, pending] = useActionState(saveTopicsAction, null);
  // The ticks come only from the saved subscription; the explanation says whether everything is subscribed.
  const state = preferenceState(topics);
  return (
    <div className="space-y-10">
      <form action={formAction} className="space-y-6" aria-label="Your topics">
        <input type="hidden" name="token" value={token} />
        <p className="text-sm leading-relaxed text-ink">{state.explanation}</p>
        <TopicFieldset
          layout="list"
          selected={state.checked}
          legend="Topics you receive"
          hint="Choose at least one topic. To stop all email, use the unsubscribe button below."
          idPrefix="pref"
        />
        <Button type="submit" disabled={pending} className="min-h-11">
          {pending ? "Saving..." : "Save my topics"}
        </Button>
        <ResultMessage result={result} />
      </form>

      <section aria-labelledby="unsub-heading" className="space-y-3 border-t border-line pt-8">
        <h2 id="unsub-heading" className="font-heading text-2xl text-ink">Unsubscribe from everything</h2>
        <p className="text-sm leading-relaxed text-ink-soft">You will stop receiving all newsletter email. You can sign up again at any time.</p>
        <TokenActionForm action={unsubscribeAction} token={token} label="Unsubscribe from everything" tone="danger" />
      </section>
    </div>
  );
}
