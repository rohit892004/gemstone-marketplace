"use client";

import { ImageOff } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { useActionState, useId } from "react";
import type { ContentActionState } from "@/app/admin/content/actions";
import { DANGER_BUTTON } from "@/components/admin/button-classes";
import { CoverImage } from "@/components/content/content-ui";
import { Button } from "@/components/ui/button";

type Action = (prev: ContentActionState, formData: FormData) => Promise<ContentActionState>;

/** Cover image upload. JPEG or PNG, checked by size and file signature on the server. Alt text is saved with the content form. */
export function CoverForm({ id, coverKey, coverAlt, action }: { id: string; coverKey: string | null; coverAlt: string | null; action: Action }) {
  const inputId = useId();
  const [state, formAction, pending] = useActionState(action, null);

  return (
    <section aria-labelledby={`${inputId}-heading`} className="space-y-5 border border-line bg-surface-raised p-5 sm:p-6">
      <h2 id={`${inputId}-heading`} className="font-heading text-2xl text-ink">
        Cover image
      </h2>
      {coverKey ? (
        <div className="space-y-2">
          <CoverImage coverKey={coverKey} alt={coverAlt} className="max-h-64" />
          <p className="text-[12px] text-ink-soft">
            {coverAlt ? <>Alt text: {coverAlt}</> : <span className="text-danger">No alt text yet. Add it in the content form.</span>}
          </p>
        </div>
      ) : (
        <EmptyState icon={ImageOff} title="No cover image" body="Covers are optional." />
      )}
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="id" value={id} />
        <div className="space-y-2">
          <label htmlFor={inputId} className="block text-[13px] tracking-wide text-ink">
            Upload a JPEG or PNG
          </label>
          <input
            id={inputId}
            type="file"
            name="file"
            accept="image/jpeg,image/png"
            className="block min-h-11 w-full text-sm text-ink file:mr-3 file:min-h-11 file:cursor-pointer file:border file:border-line file:bg-surface file:px-4 file:text-sm file:text-ink"
          />
        </div>
        <div className="flex flex-wrap gap-3">
          <Button type="submit" name="intent" value="upload" disabled={pending}>
            {pending ? "Uploading..." : "Upload cover"}
          </Button>
          {coverKey ? (
            <button type="submit" name="intent" value="remove" disabled={pending} className={DANGER_BUTTON}>
              Remove cover
            </button>
          ) : null}
        </div>
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
    </section>
  );
}
