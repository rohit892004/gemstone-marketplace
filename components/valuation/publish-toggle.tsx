"use client";

import { useId, useState, useTransition } from "react";
import { setPublishedAction } from "@/app/valuation/actions";
import { ErrorSummary, primaryButtonClass, secondaryButtonClass } from "./ui";

/**
 * Lets the seller of a listing publish or hide their own completed report on that listing. The server checks the
 * rule again (canPublishOnListing). This control only shows the state and sends the choice.
 */
export function PublishToggle({ valuationId, initiallyPublished }: { valuationId: string; initiallyPublished: boolean }) {
  const ids = useId();
  const [published, setPublished] = useState(initiallyPublished);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function change(next: boolean) {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await setPublishedAction(valuationId, next);
      if (result.ok) {
        setPublished(next);
        setMessage(result.message ?? null);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <section aria-labelledby={`${ids}-heading`} className="space-y-3 border border-line bg-surface-raised p-5">
      <h2 id={`${ids}-heading`} className="font-heading text-2xl text-ink">
        Show on your listing
      </h2>
      <p className="text-sm text-ink-soft">
        When published, this completed report appears on your listing as <span className="text-ink">Platform indicative valuation</span>, with its date, the
        estimate, the range and the disclaimer. Buyers see it. Your requester details are never shown. You can hide it again at any time.
      </p>
      <ErrorSummary messages={error ? [error] : []} title="The change was not saved" />
      {message ? (
        <p role="status" className="text-sm text-ink-soft">
          {message}
        </p>
      ) : null}
      <p className="text-sm text-ink">
        Status: <span className="font-medium">{published ? "Published on your listing" : "Not published"}</span>
      </p>
      {published ? (
        <button type="button" disabled={pending} onClick={() => change(false)} className={secondaryButtonClass}>
          {pending ? "Saving..." : "Hide from listing"}
        </button>
      ) : (
        <button type="button" disabled={pending} onClick={() => change(true)} className={primaryButtonClass}>
          {pending ? "Saving..." : "Publish on my listing"}
        </button>
      )}
    </section>
  );
}
