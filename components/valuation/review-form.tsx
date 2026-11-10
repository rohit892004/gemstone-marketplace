"use client";

import Link from "next/link";
import { useActionState, useId, useState, useTransition } from "react";
import { setRequestExpertAction, submitValuationAction } from "@/app/valuation/actions";
import { submitBlockReason } from "@/lib/valuation/requester-form";
import { REQUESTER_PATHS } from "@/lib/valuation/requester-paths";
import { ErrorSummary, primaryButtonClass, secondaryButtonClass } from "./ui";

export interface ReviewFormProps {
  valuationId: string;
  photoCount: number;
  initialRequestExpert: boolean;
}

/**
 * Step 2. The expert checkbox saves straight away (setRequestExpert) and is sent again with the submit. Submit is
 * blocked with no photo, and the reason is shown next to the button.
 */
export function ReviewForm({ valuationId, photoCount, initialRequestExpert }: ReviewFormProps) {
  const ids = useId();
  const [state, formAction, pending] = useActionState(submitValuationAction, null);
  const [requestExpert, setRequestExpertState] = useState(initialRequestExpert);
  const [expertError, setExpertError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const blockReason = submitBlockReason(photoCount);

  function onToggle(checked: boolean) {
    setRequestExpertState(checked);
    setExpertError(null);
    startTransition(async () => {
      const result = await setRequestExpertAction(valuationId, checked);
      if (!result.ok) {
        setExpertError(result.error);
        setRequestExpertState(!checked);
      }
    });
  }

  const summary = [state && !state.ok ? state.error : null, expertError].filter((m): m is string => !!m);

  return (
    <form action={formAction} className="space-y-6" aria-label="Submit valuation request">
      <input type="hidden" name="valuationId" value={valuationId} />
      {requestExpert ? <input type="hidden" name="requestExpert" value="on" /> : null}

      <ErrorSummary messages={summary} title="The request was not sent" />

      <div className="space-y-3 border border-line bg-surface-raised p-5 shadow-soft sm:p-6">
        <label htmlFor={`${ids}-expert`} className="flex min-h-11 items-start gap-3 text-sm text-ink">
          <input
            id={`${ids}-expert`}
            type="checkbox"
            checked={requestExpert}
            onChange={(e) => onToggle(e.currentTarget.checked)}
            className="mt-0.5 size-5 accent-brand"
          />
          <span>
            <span className="font-medium">Ask an expert valuer to review this</span>
            <span className="mt-1 block leading-relaxed text-ink-soft">
              A valuer will look at your photos and details, and may ask you one question. The result then takes longer, but it is signed off by a person.
            </span>
          </span>
        </label>
      </div>

      <div className="border-l-2 border-accent bg-surface-raised px-5 py-4 text-sm leading-relaxed text-ink-soft">
        <p>
          The automatic estimate uses reference prices and the details you entered. It does not look at your photos. Photos are for the expert valuer.
        </p>
      </div>

      {blockReason ? (
        <p id={`${ids}-block`} className="text-sm text-danger">
          {blockReason}
        </p>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
        <Link href={REQUESTER_PATHS.upload(valuationId)} className={`${secondaryButtonClass} sm:mr-auto`}>
          Back to details
        </Link>
        <button type="submit" disabled={pending || photoCount < 1} aria-describedby={blockReason ? `${ids}-block` : undefined} className={primaryButtonClass}>
          {pending ? "Submitting..." : "Submit for valuation"}
        </button>
      </div>
    </form>
  );
}
