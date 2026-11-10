"use client";

import { useActionState, useId } from "react";
import type { ContentActionState } from "@/app/admin/content/actions";
import { MarkdownEditor } from "@/components/admin/content/markdown-editor";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/field";
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

const LABEL = "block text-[13px] tracking-wide text-ink";
const HINT = "text-[12px] text-ink-soft";
const ERROR = "text-sm text-danger";

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
    <form action={formAction} className="space-y-8" aria-label="Article content">
      {values.id ? <input type="hidden" name="id" value={values.id} /> : null}

      <fieldset className="grid gap-6 md:grid-cols-2">
        <legend className="sr-only">Article details</legend>
        <div className="space-y-2">
          <label htmlFor={field("type")} className={LABEL}>
            Content type
          </label>
          <Select id={field("type")} name="type" defaultValue={values.type} required>
            {CONTENT_TYPES.map((option) => (
              <option key={option} value={option}>
                {TYPE_LABELS[option]}
              </option>
            ))}
          </Select>
          {fieldError("type") ? <p className={ERROR}>{fieldError("type")}</p> : null}
        </div>
        <div className="space-y-2">
          <label htmlFor={field("title")} className={LABEL}>
            Title
          </label>
          <Input id={field("title")} name="title" required maxLength={200} defaultValue={values.title} />
          {fieldError("title") ? <p className={ERROR}>{fieldError("title")}</p> : null}
        </div>
        <div className="space-y-2 md:col-span-2">
          <label htmlFor={field("summary")} className={LABEL}>
            Summary
          </label>
          <p className={HINT}>Shown on cards and in search. Up to {SUMMARY_MAX} characters.</p>
          <Textarea id={field("summary")} name="summary" rows={2} maxLength={SUMMARY_MAX} defaultValue={values.summary} />
          {fieldError("summary") ? <p className={ERROR}>{fieldError("summary")}</p> : null}
        </div>
        <div className="space-y-2">
          <label htmlFor={field("tags")} className={LABEL}>
            Tags
          </label>
          <p className={HINT}>Separate with commas, for example: ruby, heat treatment.</p>
          <Input id={field("tags")} name="tags" defaultValue={values.tags.join(", ")} />
        </div>
        <div className="space-y-2">
          <label htmlFor={field("coverAlt")} className={LABEL}>
            Cover alt text
          </label>
          <p className={HINT}>Describe the cover for screen reader users. Needed when a cover is set.</p>
          <Input id={field("coverAlt")} name="coverAlt" maxLength={200} defaultValue={values.coverAlt} />
        </div>
        <div className="space-y-2">
          <label htmlFor={field("category")} className={LABEL}>
            News category
          </label>
          <p className={HINT}>Market news only.</p>
          <Select id={field("category")} name="category" defaultValue={values.category}>
            <option value="">None</option>
            {NEWS_CATEGORIES.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
          {fieldError("category") ? <p className={ERROR}>{fieldError("category")}</p> : null}
        </div>
        <div className="space-y-2">
          <label htmlFor={field("sourceName")} className={LABEL}>
            Source name
          </label>
          <p className={HINT}>Market news only. Required to publish news.</p>
          <Input id={field("sourceName")} name="sourceName" maxLength={200} defaultValue={values.sourceName} />
        </div>
        <div className="space-y-2">
          <label htmlFor={field("sourceUrl")} className={LABEL}>
            Source link
          </label>
          <p className={HINT}>Market news only. A full https:// link to the original report.</p>
          <Input id={field("sourceUrl")} name="sourceUrl" type="url" maxLength={500} defaultValue={values.sourceUrl} />
          {fieldError("sourceUrl") ? <p className={ERROR}>{fieldError("sourceUrl")}</p> : null}
        </div>
        <div className="space-y-2 md:col-span-2">
          <label htmlFor={field("metaDescription")} className={LABEL}>
            Search description
          </label>
          <p className={HINT}>Optional. Up to {META_DESCRIPTION_MAX} characters. Falls back to the summary.</p>
          <Input id={field("metaDescription")} name="metaDescription" maxLength={META_DESCRIPTION_MAX} defaultValue={values.metaDescription} />
          {fieldError("metaDescription") ? <p className={ERROR}>{fieldError("metaDescription")}</p> : null}
        </div>
      </fieldset>

      <MarkdownEditor name="body" label="Content (Markdown)" defaultValue={values.body} rows={18} required />
      {fieldError("body") ? <p className={ERROR}>{fieldError("body")}</p> : null}

      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving..." : values.id ? "Save draft" : "Create draft"}
        </Button>
        {state && !state.ok ? (
          <p role="alert" className={ERROR}>
            {state.error}
          </p>
        ) : null}
        {state && state.ok ? (
          <p role="status" className="text-sm text-success">
            {state.message}
          </p>
        ) : null}
      </div>
    </form>
  );
}
