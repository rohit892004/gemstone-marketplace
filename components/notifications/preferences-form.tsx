"use client";

import { useActionState } from "react";
import type { NotificationPrefs } from "@/lib/notifications/rules";
import { savePreferences, type PreferencesActionState } from "@/app/notifications/actions";

const ROWS: { name: keyof Omit<NotificationPrefs, "emailEnabled">; label: string; help: string }[] = [
  { name: "enquiries", label: "New enquiries", help: "Someone enquires about one of your listings, or writes to you." },
  { name: "messages", label: "New messages", help: "Sent as a digest, at most one email per 10 minutes." },
  { name: "offersAndQuotes", label: "Offers and quotations", help: "Offers, responses, and quotations sent or answered." },
  { name: "requirements", label: "Requirements", help: "Matching buyer requirements, and responses to yours." },
  { name: "valuations", label: "Valuations", help: "Status changes and questions on your valuation requests." },
];

/** Preferences form. Email is the master switch; the category switches only matter when it is on. */
export function PreferencesForm({ prefs }: { prefs: NotificationPrefs }) {
  const [state, formAction, pending] = useActionState<PreferencesActionState, FormData>(savePreferences, null);

  return (
    <form action={formAction} className="space-y-6">
      <fieldset className="space-y-4 rounded-lg border border-line bg-surface-raised p-4 sm:p-5">
        <legend className="px-1 text-sm font-semibold text-ink">Email</legend>
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            name="emailEnabled"
            defaultChecked={prefs.emailEnabled}
            className="mt-1 h-4 w-4 accent-brand"
          />
          <span>
            <span className="block text-sm font-medium text-ink">Send me email notifications</span>
            <span className="block text-sm text-ink-soft">
              Off means you only see notifications on the site. Emails go only to your own address.
            </span>
          </span>
        </label>
      </fieldset>

      <fieldset className="space-y-4 rounded-lg border border-line bg-surface-raised p-4 sm:p-5">
        <legend className="px-1 text-sm font-semibold text-ink">Email me about</legend>
        {ROWS.map((row) => (
          <label key={row.name} className="flex items-start gap-3">
            <input
              type="checkbox"
              name={row.name}
              defaultChecked={prefs[row.name]}
              className="mt-1 h-4 w-4 accent-brand"
            />
            <span>
              <span className="block text-sm font-medium text-ink">{row.label}</span>
              <span className="block text-sm text-ink-soft">{row.help}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-strong disabled:opacity-50"
        >
          {pending ? "Saving..." : "Save preferences"}
        </button>
        {state?.ok ? (
          <p role="status" className="text-sm text-ink-soft">{state.message}</p>
        ) : null}
        {state && !state.ok ? (
          <p role="alert" className="text-sm text-red-700">{state.error}</p>
        ) : null}
      </div>
    </form>
  );
}
