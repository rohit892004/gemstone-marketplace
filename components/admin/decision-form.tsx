"use client";

import { useActionState } from "react";
import type { AdminActionState } from "@/lib/admin/action-state";

interface DecisionFormProps {
  action: (prev: AdminActionState, formData: FormData) => Promise<AdminActionState>;
  sellerId: string;
  title: string;
  description: string;
  submitLabel: string;
  /** When set, a required reason field is shown with this label. */
  reasonLabel?: string;
  tone?: "primary" | "danger";
}

/** One admin decision. Shows the server result and disables itself while pending. */
export function DecisionForm({
  action,
  sellerId,
  title,
  description,
  submitLabel,
  reasonLabel,
  tone = "primary",
}: DecisionFormProps) {
  const [state, formAction, pending] = useActionState(action, null);

  const buttonClass =
    tone === "danger"
      ? "rounded bg-red-700 px-4 py-2 text-white disabled:opacity-50"
      : "rounded bg-stone-900 px-4 py-2 text-white disabled:opacity-50";

  return (
    <form action={formAction} className="space-y-3 rounded border border-stone-300 bg-white p-4">
      <div>
        <h3 className="font-medium">{title}</h3>
        <p className="text-sm text-stone-600">{description}</p>
      </div>
      <input type="hidden" name="sellerId" value={sellerId} />
      {reasonLabel ? (
        <label className="block space-y-1 text-sm">
          <span className="font-medium">{reasonLabel}</span>
          <textarea
            name="reason"
            required
            minLength={10}
            maxLength={1000}
            rows={3}
            className="w-full rounded border border-stone-300 p-2"
          />
        </label>
      ) : null}
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Saving..." : submitLabel}
      </button>
      {state && !state.ok ? (
        <p role="alert" className="text-sm text-red-700">
          {state.error}
        </p>
      ) : null}
      {state && state.ok ? (
        <p role="status" className="text-sm text-green-800">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
