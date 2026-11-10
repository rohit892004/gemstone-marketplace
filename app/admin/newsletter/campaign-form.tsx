"use client";

import { useActionState } from "react";
import { TopicFieldset } from "@/components/newsletter/topic-fieldset";
import type { AdminActionState } from "@/lib/admin/action-state";

export interface CampaignFormDefaults {
  id?: string;
  subject?: string;
  preheader?: string | null;
  body?: string;
  topics?: string[];
}

/** Composer for a new or editable campaign. The body is Markdown. The preview is on the detail page. */
export function CampaignForm({
  action,
  defaults,
  submitLabel,
}: {
  action: (prev: AdminActionState, formData: FormData) => Promise<AdminActionState>;
  defaults: CampaignFormDefaults;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction} className="space-y-5 border border-line bg-surface-raised p-4" aria-label="Campaign">
      {defaults.id ? <input type="hidden" name="id" value={defaults.id} /> : null}

      <div className="space-y-1">
        <label htmlFor="campaign-subject" className="block text-sm font-medium text-ink">Subject</label>
        <input id="campaign-subject" name="subject" required maxLength={150} defaultValue={defaults.subject ?? ""} className="block w-full border border-line bg-surface-raised px-4 py-3 text-[15px] text-ink" />
      </div>

      <div className="space-y-1">
        <label htmlFor="campaign-preheader" className="block text-sm font-medium text-ink">Preheader (optional)</label>
        <input id="campaign-preheader" name="preheader" maxLength={200} defaultValue={defaults.preheader ?? ""} className="block w-full border border-line bg-surface-raised px-4 py-3 text-[15px] text-ink" />
        <p className="text-[12px] text-ink-soft">Short preview line shown by some mail apps.</p>
      </div>

      <TopicFieldset selected={defaults.topics ?? []} legend="Send to subscribers who chose" idPrefix="campaign-topic" />

      <div className="space-y-1">
        <label htmlFor="campaign-body" className="block text-sm font-medium text-ink">Body (Markdown)</label>
        <textarea id="campaign-body" name="body" required rows={16} defaultValue={defaults.body ?? ""} className="block w-full border border-line bg-surface-raised px-4 py-3 font-mono text-[14px] text-ink" />
        <p className="text-[12px] text-ink-soft">Raw HTML is not allowed. Links must be https, http, mailto or site paths. The footer with the unsubscribe link is added automatically.</p>
      </div>

      <button type="submit" disabled={pending} className="bg-brand px-4 py-2 text-ivory disabled:opacity-50">
        {pending ? "Saving..." : submitLabel}
      </button>

      <p role="status" aria-live="polite" className={state?.ok === false ? "text-sm text-danger" : "text-sm text-ink"}>
        {state === null ? "" : state.ok ? state.message : state.error}
      </p>
    </form>
  );
}
