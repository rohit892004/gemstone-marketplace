"use client";

import { useActionState } from "react";
import { unsubscribeAccountNewsletterAction, saveAccountNewsletterAction } from "@/app/account/newsletter-settings/actions";
import type { AccountNewsletterState } from "@/lib/newsletter/account";
import { TOPIC_LABELS } from "@/lib/newsletter/topics";
import { ResultMessage } from "./result-message";
import { TopicFieldset } from "./topic-fieldset";

/** Newsletter section of the account page. The current state comes from the server. */
export function NewsletterSettings({ current }: { current: AccountNewsletterState | null }) {
  const [saveResult, saveAction, saving] = useActionState(saveAccountNewsletterAction, null);
  const [unsubResult, unsubAction, unsubscribing] = useActionState(unsubscribeAccountNewsletterAction, null);
  const subscribed = current?.status === "CONFIRMED";
  const pending = current?.status === "PENDING";

  return (
    <section aria-labelledby="newsletter-settings-heading" className="mt-10 space-y-5 border-t border-line pt-8">
      <h2 id="newsletter-settings-heading" className="text-xl font-semibold text-ink">Newsletter</h2>
      <p className="text-sm text-ink-soft">
        {subscribed
          ? `You receive the newsletter on: ${(current?.topics ?? []).map((t) => TOPIC_LABELS[t]).join(", ") || "no topics"}.`
          : pending
            ? "Your sign-up is waiting for confirmation. Check your email for the link."
            : "You are not receiving the newsletter."}
      </p>

      <form action={saveAction} className="space-y-4" aria-label="Newsletter topics">
        <TopicFieldset selected={subscribed || pending ? current?.topics ?? [] : []} legend="Topics" idPrefix="account-topic" />
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-brand-strong px-5 py-2.5 font-medium text-white hover:opacity-90 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          {saving ? "Saving..." : subscribed ? "Save topics" : "Subscribe"}
        </button>
        <ResultMessage result={saveResult} />
      </form>

      {subscribed ? (
        <form action={unsubAction} className="space-y-2">
          <button
            type="submit"
            disabled={unsubscribing}
            className="rounded-md border border-line px-5 py-2.5 font-medium text-ink hover:border-ink-soft disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            {unsubscribing ? "Working..." : "Unsubscribe from the newsletter"}
          </button>
          <ResultMessage result={unsubResult} />
        </form>
      ) : null}
    </section>
  );
}
