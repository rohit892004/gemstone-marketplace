"use client";

import { useActionState, useState } from "react";
import type { ContentActionState } from "@/app/admin/content/actions";
import type { ContentStatusName } from "@/lib/content/status";

type Action = (prev: ContentActionState, formData: FormData) => Promise<ContentActionState>;

interface StatusPanelProps {
  id: string;
  status: ContentStatusName;
  scheduledFor: string | null;
  action: Action;
  /** Articles can be scheduled. Reference pages publish directly. */
  canSchedule: boolean;
}

/** Local date and time as the value for datetime-local, e.g. 2026-11-12T09:30. */
function toLocalInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const STATUS_LABELS: Record<ContentStatusName, string> = {
  DRAFT: "Draft",
  SCHEDULED: "Scheduled",
  PUBLISHED: "Published",
  ARCHIVED: "Archived",
};

/**
 * Status buttons. One form, several submit buttons: each button sends its own `to` value. The schedule time is
 * converted to an ISO instant in the browser, so the server reads the same moment the editor chose.
 */
export function StatusPanel({ id, status, scheduledFor, action, canSchedule }: StatusPanelProps) {
  const [state, formAction, pending] = useActionState(action, null);
  const [when, setWhen] = useState(() => (scheduledFor ? toLocalInput(new Date(scheduledFor)) : ""));
  const [minimum] = useState(() => toLocalInput(new Date(Date.now() + 60 * 1000)));
  const scheduledIso = when ? new Date(when).toISOString() : "";
  const invalidWhen = !when || Number.isNaN(new Date(when).getTime());

  const buttonBase = "rounded-md px-4 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-50";
  const primary = `${buttonBase} bg-brand text-white hover:bg-brand-strong`;
  const secondary = `${buttonBase} border border-line bg-surface-raised text-ink hover:border-ink-soft`;
  const danger = `${buttonBase} border border-red-300 bg-surface-raised text-red-800 hover:border-red-500`;

  return (
    <section aria-labelledby={`status-${id}`} className="space-y-4 rounded-lg border border-line bg-surface-raised p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={`status-${id}`} className="text-lg font-semibold text-ink">
          Status
        </h2>
        <span className="rounded-full bg-accent-soft px-3 py-1 text-sm font-medium text-brand-strong">{STATUS_LABELS[status]}</span>
      </div>
      {scheduledFor && status === "SCHEDULED" ? (
        <p className="text-sm text-ink-soft">
          Publishes at{" "}
          <time dateTime={scheduledFor}>{new Date(scheduledFor).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</time>.
        </p>
      ) : null}

      <form action={formAction} className="space-y-4" aria-describedby={`status-help-${id}`}>
        <input type="hidden" name="id" value={id} />
        {canSchedule ? (
          <div className="space-y-1">
            <label htmlFor={`when-${id}`} className="block text-sm font-medium text-ink">
              Publish at
            </label>
            <p id={`status-help-${id}`} className="text-xs text-ink-soft">
              Pick a future time. Times are in your browser&apos;s time zone. Use &quot;Publish now&quot; to publish immediately.
            </p>
            <input
              id={`when-${id}`}
              type="datetime-local"
              min={minimum}
              value={when}
              onChange={(event) => setWhen(event.target.value)}
              className="rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink"
            />
            <input type="hidden" name="scheduledForIso" value={scheduledIso} />
          </div>
        ) : (
          <p id={`status-help-${id}`} className="text-xs text-ink-soft">
            Reference pages publish straight away. Unpublish to take a page off the site.
          </p>
        )}

        {/* The first submit button is the default for Enter in the date field, so it must never publish. */}
        <div className="flex flex-wrap gap-2">
          {canSchedule && status === "DRAFT" ? (
            <button type="submit" name="to" value="SCHEDULED" disabled={pending || invalidWhen} className={secondary}>
              Schedule
            </button>
          ) : null}
          {status === "SCHEDULED" ? (
            <button type="submit" name="to" value="DRAFT" disabled={pending} className={secondary}>
              Back to draft
            </button>
          ) : null}
          {status === "PUBLISHED" ? (
            <button type="submit" name="to" value="DRAFT" disabled={pending} className={secondary}>
              Unpublish
            </button>
          ) : null}
          {status === "DRAFT" || status === "SCHEDULED" ? (
            <button type="submit" name="to" value="PUBLISHED" disabled={pending} className={primary}>
              Publish now
            </button>
          ) : null}
          {status === "ARCHIVED" ? (
            <button type="submit" name="to" value="DRAFT" disabled={pending} className={secondary}>
              Restore to draft
            </button>
          ) : null}
          {status !== "ARCHIVED" ? (
            <button type="submit" name="to" value="ARCHIVED" disabled={pending} className={danger}>
              Archive
            </button>
          ) : null}
        </div>
        {state && !state.ok ? (
          <div role="alert" className="space-y-1 text-sm text-red-700">
            <p>{state.error}</p>
            {state.problems && state.problems.length > 1 ? (
              <ul className="list-inside list-disc">
                {state.problems.map((problem) => (
                  <li key={`${problem.field}-${problem.message}`}>{problem.message}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
        {state && state.ok ? (
          <p role="status" className="text-sm text-green-800">
            {state.message}
          </p>
        ) : null}
      </form>
    </section>
  );
}
