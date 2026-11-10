"use client";

import { useActionState, useId } from "react";
import type { ContentActionState } from "@/app/admin/content/actions";
import { MarkdownEditor } from "@/components/admin/content/markdown-editor";
import { NEWS_CATEGORIES } from "@/lib/content/listing";
import { CONTENT_TYPES, META_DESCRIPTION_MAX, SUMMARY_MAX } from "@/lib/content/status";

type Action = (prev: ContentActionState, formData: FormData) => Promise<ContentActionState>;

export interface ArticleFormValues {
  id: string | null;
  type: string;
  title: string;
  summary: string;
  body: string;
  tags: string[];
  category: string;
  sourceName: string;
  sourceUrl: string;
  coverAlt: string;
  metaDescription: string;
}

const TYPE_LABELS: Record<string, string> = { EDUCATION: "Education", GUIDE: "Guide", RESEARCH: "Research", NEWS: "Market news" };

/**
 * Article fields and the Markdown body. "Save draft" saves the content without changing the status; status moves
 * happen in the status panel. Errors from the server are shown next to the form.
 */
export function ArticleForm({ values, action }: { values: ArticleFormValues; action: Action }) {
  const uid = useId();
  const [state, formAction, pending] = useActionState(action, null);
  const field = (name: string) => `${uid}-${name}`;
  const fieldError = (name: string) => (state && !state.ok ? state.problems?.find((p) => p.field === name)?.message : undefined);

  return (
    <form action={formAction} className="space-y-6" aria-label="Article content">
      {values.id ? <input type="hidden" name="id" value={values.id} /> : null}

      <fieldset className="grid gap-4 md:grid-cols-2">
        <legend className="sr-only">Article details</legend>
        <div className="space-y-1">
          <label htmlFor={field("type")} className="block text-sm font-medium text-ink">
            Content type
          </label>
          <select id={field("type")} name="type" defaultValue={values.type} required className="w-full rounded-md border border-line bg-surface-raised px-3 py-2 text-sm">
            {CONTENT_TYPES.map((option) => (
              <option key={option} value={option}>
                {TYPE_LABELS[option]}
              </option>
            ))}
          </select>
          {fieldError("type") ? <p className="text-sm text-red-700">{fieldError("type")}</p> : null}
        </div>
        <div className="space-y-1">
          <label htmlFor={field("title")} className="block text-sm font-medium text-ink">
            Title
          </label>
          <input id={field("title")} name="title" required maxLength={200} defaultValue={values.title} className="w-full rounded-md border border-line bg-surface-raised px-3 py-2 text-sm" />
          {fieldError("title") ? <p className="text-sm text-red-700">{fieldError("title")}</p> : null}
        </div>
        <div className="space-y-1 md:col-span-2">
          <label htmlFor={field("summary")} className="block text-sm font-medium text-ink">
            Summary
          </label>
          <p className="text-xs text-ink-soft">Shown on cards and in search. Up to {SUMMARY_MAX} characters.</p>
          <textarea id={field("summary")} name="summary" rows={2} maxLength={SUMMARY_MAX} defaultValue={values.summary} className="w-full rounded-md border border-line bg-surface-raised px-3 py-2 text-sm" />
          {fieldError("summary") ? <p className="text-sm text-red-700">{fieldError("summary")}</p> : null}
        </div>
        <div className="space-y-1">
          <label htmlFor={field("tags")} className="block text-sm font-medium text-ink">
            Tags
          </label>
          <p className="text-xs text-ink-soft">Separate with commas, for example: ruby, heat treatment.</p>
          <input id={field("tags")} name="tags" defaultValue={values.tags.join(", ")} className="w-full rounded-md border border-line bg-surface-raised px-3 py-2 text-sm" />
        </div>
        <div className="space-y-1">
          <label htmlFor={field("coverAlt")} className="block text-sm font-medium text-ink">
            Cover alt text
          </label>
          <p className="text-xs text-ink-soft">Describe the cover for screen reader users. Needed when a cover is set.</p>
          <input id={field("coverAlt")} name="coverAlt" maxLength={200} defaultValue={values.coverAlt} className="w-full rounded-md border border-line bg-surface-raised px-3 py-2 text-sm" />
        </div>
        <div className="space-y-1">
          <label htmlFor={field("category")} className="block text-sm font-medium text-ink">
            News category
          </label>
          <p className="text-xs text-ink-soft">Market news only.</p>
          <select id={field("category")} name="category" defaultValue={values.category} className="w-full rounded-md border border-line bg-surface-raised px-3 py-2 text-sm">
            <option value="">None</option>
            {NEWS_CATEGORIES.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          {fieldError("category") ? <p className="text-sm text-red-700">{fieldError("category")}</p> : null}
        </div>
        <div className="space-y-1">
          <label htmlFor={field("sourceName")} className="block text-sm font-medium text-ink">
            Source name
          </label>
          <p className="text-xs text-ink-soft">Market news only. Required to publish news.</p>
          <input id={field("sourceName")} name="sourceName" maxLength={200} defaultValue={values.sourceName} className="w-full rounded-md border border-line bg-surface-raised px-3 py-2 text-sm" />
        </div>
        <div className="space-y-1">
          <label htmlFor={field("sourceUrl")} className="block text-sm font-medium text-ink">
            Source link
          </label>
          <p className="text-xs text-ink-soft">Market news only. A full https:// link to the original report.</p>
          <input id={field("sourceUrl")} name="sourceUrl" type="url" maxLength={500} defaultValue={values.sourceUrl} className="w-full rounded-md border border-line bg-surface-raised px-3 py-2 text-sm" />
          {fieldError("sourceUrl") ? <p className="text-sm text-red-700">{fieldError("sourceUrl")}</p> : null}
        </div>
        <div className="space-y-1 md:col-span-2">
          <label htmlFor={field("metaDescription")} className="block text-sm font-medium text-ink">
            Search description
          </label>
          <p className="text-xs text-ink-soft">Optional. Up to {META_DESCRIPTION_MAX} characters. Falls back to the summary.</p>
          <input id={field("metaDescription")} name="metaDescription" maxLength={META_DESCRIPTION_MAX} defaultValue={values.metaDescription} className="w-full rounded-md border border-line bg-surface-raised px-3 py-2 text-sm" />
          {fieldError("metaDescription") ? <p className="text-sm text-red-700">{fieldError("metaDescription")}</p> : null}
        </div>
      </fieldset>

      <MarkdownEditor name="body" label="Content (Markdown)" defaultValue={values.body} rows={18} required />
      {fieldError("body") ? <p className="text-sm text-red-700">{fieldError("body")}</p> : null}

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className="rounded-md bg-ink px-5 py-2.5 text-sm font-medium text-surface-raised hover:bg-ink-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-50">
          {pending ? "Saving..." : values.id ? "Save draft" : "Create draft"}
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
      </div>
    </form>
  );
}
