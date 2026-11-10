"use client";

import { useActionState } from "react";
import { startValuationAction } from "@/app/valuation/actions";
import { primaryButtonClass } from "./ui";

/** Starts a valuation draft. With gemstoneId it is prefilled from that listing. Goes to step 1 on success. */
export function StartValuationButton({ gemstoneId, label = "Start a valuation" }: { gemstoneId?: string; label?: string }) {
  const [state, formAction, pending] = useActionState(startValuationAction, null);
  return (
    <form action={formAction} className="space-y-2">
      {gemstoneId ? <input type="hidden" name="gemstoneId" value={gemstoneId} /> : null}
      <button type="submit" disabled={pending} className={primaryButtonClass}>
        {pending ? "Starting..." : label}
      </button>
      {state && !state.ok ? (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
