"use client";

import { useActionState, useId } from "react";
import type { AdminActionState } from "@/lib/admin/action-state";
import { adminButtonClass } from "@/components/admin/button-classes";
import { Textarea } from "@/components/ui/field";

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
  const reasonId = useId();

  return (
    <form action={formAction} className="space-y-4 border border-line bg-surface-raised p-5 sm:p-6">
      <div className="space-y-2">
        <h3 className="font-heading text-xl text-ink">{title}</h3>
        <p className="text-sm leading-relaxed text-ink-soft">{description}</p>
      </div>
      <input type="hidden" name="sellerId" value={sellerId} />
      {reasonLabel ? (
        <div className="space-y-2">
          <label htmlFor={reasonId} className="block text-[13px] tracking-wide text-ink">
            {reasonLabel}
          </label>
          <Textarea id={reasonId} name="reason" required minLength={10} maxLength={1000} rows={3} />
        </div>
      ) : null}
      <button type="submit" disabled={pending} className={adminButtonClass(tone === "danger")}>
        {pending ? "Saving..." : submitLabel}
      </button>
      {state && !state.ok ? (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      ) : null}
      {state && state.ok ? (
        <p role="status" className="text-sm text-success">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
