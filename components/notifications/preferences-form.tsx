"use client";

import { Button } from "@/components/ui/button";
import { useActionState } from "react";
import type { NotificationPrefs } from "@/lib/notifications/rules";
import { savePreferences, type PreferencesActionState } from "@/app/notifications/actions";

const ROWS: { name: keyof Omit<NotificationPrefs, "emailEnabled">; label: string; help: string }[] = [
  { name: "enquiries", label: "New enquiries", help: "Someone enquires about one of your listings, or writes to you." },
  { name: "messages", label: "New messages", help: "Sent as a digest, at most one email per 10 minutes." },
  { name: "offersAndQuotes", label: "Offers and quotations", help: "Offers, responses, and quotations sent or answered." },
  { name: "requirements", label: "Requirements", help: "Matching buyer requirements, and responses to yours." },
  { name: "valuations", label: "Valuations", help: "Status changes and questions on your valuation requests." },
  { name: "membership", label: "Followers and membership", help: "New listings from sellers you follow, referrals that qualify, and membership changes." },
];

/** Preferences form. Email is the master switch; the category switches only matter when it is on. */
export function PreferencesForm({ prefs }: { prefs: NotificationPrefs }) {
  const [state, formAction, pending] = useActionState<PreferencesActionState, FormData>(savePreferences, null);

  return (
    <form action={formAction} className="space-y-8">
      <fieldset className="space-y-5 border border-line bg-surface-raised p-5 sm:p-6">
        <legend className="px-1 font-heading text-2xl text-ink">Email</legend>
        <label className="flex min-h-11 items-start gap-3">
          <input
            type="checkbox"
            name="emailEnabled"
            defaultChecked={prefs.emailEnabled}
            className="mt-1 h-5 w-5 accent-brand"
          />
          <span>
            <span className="block text-sm font-medium text-ink">Send me email notifications</span>
            <span className="block text-sm text-ink-soft">
              Off means you only see notifications on the site. Emails go only to your own address.
            </span>
          </span>
        </label>
      </fieldset>

      <fieldset className="space-y-5 border border-line bg-surface-raised p-5 sm:p-6">
        <legend className="px-1 font-heading text-2xl text-ink">Email me about</legend>
        {ROWS.map((row) => (
          <label key={row.name} className="flex min-h-11 items-start gap-3">
            <input
              type="checkbox"
              name={row.name}
              defaultChecked={prefs[row.name]}
              className="mt-1 h-5 w-5 accent-brand"
            />
            <span>
              <span className="block text-sm font-medium text-ink">{row.label}</span>
              <span className="block text-sm text-ink-soft">{row.help}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving..." : "Save preferences"}
        </Button>
        {state?.ok ? (
          <p role="status" className="text-sm text-ink-soft">{state.message}</p>
        ) : null}
        {state && !state.ok ? (
          <p role="alert" className="text-sm text-danger">{state.error}</p>
        ) : null}
      </div>
    </form>
  );
}
