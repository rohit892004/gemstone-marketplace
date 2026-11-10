"use client";

import { Input } from "@/components/ui/field";
import { useActionState, useState } from "react";
import type { ContentActionState } from "@/app/admin/content/actions";
import type { ContentStatusName } from "@/lib/content/status";
import { Badge } from "@/components/ui/badge";

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

  const buttonBase = "inline-flex min-h-11 items-center justify-center px-5 py-2.5 text-sm tracking-wide transition duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50";
  const primary = `${buttonBase} bg-brand text-ivory hover:bg-brand/90`;
  const secondary = `${buttonBase} border border-brand text-brand hover:bg-brand/5`;
  const danger = `${buttonBase} border border-danger text-danger hover:bg-danger/5`;

  return (
    <section aria-labelledby={`status-${id}`} className="space-y-5 border border-line bg-surface-raised p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={`status-${id}`} className="font-heading text-2xl text-ink">
          Status
        </h2>
        <Badge tone={status === "PUBLISHED" ? "success" : status === "SCHEDULED" ? "accent" : "neutral"}>{STATUS_LABELS[status]}</Badge>
      </div>
      {scheduledFor && status === "SCHEDULED" ? (
        <p className="text-[15px] text-ink-soft">
          Publishes at{" "}
          <time dateTime={scheduledFor}>{new Date(scheduledFor).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</time>.
        </p>
      ) : null}

      <form action={formAction} className="space-y-4" aria-describedby={`status-help-${id}`}>
        <input type="hidden" name="id" value={id} />
        {canSchedule ? (
          <div className="space-y-2">
            <label htmlFor={`when-${id}`} className="block text-[13px] tracking-wide text-ink">
              Publish at
            </label>
            <p id={`status-help-${id}`} className="text-[12px] text-ink-soft">
              Pick a future time. Times are in your browser&apos;s time zone. Use &quot;Publish now&quot; to publish immediately.
            </p>
            <Input
              id={`when-${id}`}
              type="datetime-local"
              min={minimum}
              value={when}
              onChange={(event) => setWhen(event.target.value)}
            />
            <input type="hidden" name="scheduledForIso" value={scheduledIso} />
          </div>
        ) : (
          <p id={`status-help-${id}`} className="text-[12px] text-ink-soft">
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
          <div role="alert" className="space-y-1 text-sm text-danger">
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
          <p role="status" className="text-sm text-success">
            {state.message}
          </p>
        ) : null}
      </form>
    </section>
  );
}
