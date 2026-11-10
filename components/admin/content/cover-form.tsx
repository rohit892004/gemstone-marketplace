"use client";

import { useActionState, useId } from "react";
import type { ContentActionState } from "@/app/admin/content/actions";
import { CoverImage } from "@/components/content/content-ui";

type Action = (prev: ContentActionState, formData: FormData) => Promise<ContentActionState>;

/** Cover image upload. JPEG or PNG, checked by size and file signature on the server. Alt text is saved with the content form. */
export function CoverForm({ id, coverKey, coverAlt, action }: { id: string; coverKey: string | null; coverAlt: string | null; action: Action }) {
  const inputId = useId();
  const [state, formAction, pending] = useActionState(action, null);

  return (
    <section aria-labelledby={`${inputId}-heading`} className="space-y-4 rounded-lg border border-line bg-surface-raised p-5">
      <h2 id={`${inputId}-heading`} className="text-lg font-semibold text-ink">
        Cover image
      </h2>
      {coverKey ? (
        <div className="space-y-2">
          <CoverImage coverKey={coverKey} alt={coverAlt} className="max-h-64" />
          <p className="text-xs text-ink-soft">
            {coverAlt ? <>Alt text: {coverAlt}</> : <span className="text-red-700">No alt text yet. Add it in the content form.</span>}
          </p>
        </div>
      ) : (
        <p className="text-sm text-ink-soft">No cover image. Covers are optional.</p>
      )}
      <form action={formAction} className="space-y-3">
        <input type="hidden" name="id" value={id} />
        <div className="space-y-1">
          <label htmlFor={inputId} className="block text-sm font-medium text-ink">
            Upload a JPEG or PNG
          </label>
          <input
            id={inputId}
            type="file"
            name="file"
            accept="image/jpeg,image/png"
            className="block text-sm text-ink file:mr-3 file:rounded-md file:border file:border-line file:bg-surface file:px-3 file:py-2"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="submit" name="intent" value="upload" disabled={pending} className="rounded-md bg-ink px-4 py-2 text-sm font-medium text-surface-raised hover:bg-ink-soft disabled:opacity-50">
            {pending ? "Uploading..." : "Upload cover"}
          </button>
          {coverKey ? (
            <button type="submit" name="intent" value="remove" disabled={pending} className="rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-800 hover:border-red-500 disabled:opacity-50">
              Remove cover
            </button>
          ) : null}
        </div>
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
    </section>
  );
}
