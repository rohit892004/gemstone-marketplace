"use client";

import { useActionState, useId } from "react";
import type { ContentActionState } from "@/app/admin/content/actions";
import { MarkdownEditor } from "@/components/admin/content/markdown-editor";
import { REFERENCE_SECTIONS } from "@/lib/content/reference-sections";
import { SUMMARY_MAX } from "@/lib/content/status";

type Action = (prev: ContentActionState, formData: FormData) => Promise<ContentActionState>;

export interface ReferenceFormValues {
  id: string | null;
  name: string;
  categorySlug: string;
  summary: string;
  hardness: string;
  metaDescription: string;
  sortOrder: number;
  sections: Record<(typeof REFERENCE_SECTIONS)[number]["key"], string>;
}

/** Gemstone reference page: the basics, then one Markdown editor per section, in the order the public page shows them. */
export function ReferenceForm({
  values,
  categories,
  action,
}: {
  values: ReferenceFormValues;
  categories: { slug: string; name: string }[];
  action: Action;
}) {
  const uid = useId();
  const [state, formAction, pending] = useActionState(action, null);
  const field = (name: string) => `${uid}-${name}`;

  return (
    <form action={formAction} className="space-y-6" aria-label="Reference page content">
      {values.id ? <input type="hidden" name="id" value={values.id} /> : null}

      <fieldset className="grid gap-4 md:grid-cols-2">
        <legend className="sr-only">Gemstone details</legend>
        <div className="space-y-1">
          <label htmlFor={field("name")} className="block text-sm font-medium text-ink">
            Gemstone name
          </label>
          <input id={field("name")} name="name" required maxLength={120} defaultValue={values.name} className="w-full rounded-md border border-line bg-surface-raised px-3 py-2 text-sm" />
        </div>
        <div className="space-y-1">
          <label htmlFor={field("categorySlug")} className="block text-sm font-medium text-ink">
            Catalogue category
          </label>
          <p className="text-xs text-ink-soft">Links this page to the matching listings and the valuation form.</p>
          <select id={field("categorySlug")} name="categorySlug" required defaultValue={values.categorySlug} className="w-full rounded-md border border-line bg-surface-raised px-3 py-2 text-sm">
            <option value="" disabled>
              Choose a category
            </option>
            {categories.map((category) => (
              <option key={category.slug} value={category.slug}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1 md:col-span-2">
          <label htmlFor={field("summary")} className="block text-sm font-medium text-ink">
            Summary
          </label>
          <textarea id={field("summary")} name="summary" required rows={2} maxLength={SUMMARY_MAX} defaultValue={values.summary} className="w-full rounded-md border border-line bg-surface-raised px-3 py-2 text-sm" />
        </div>
        <div className="space-y-1">
          <label htmlFor={field("hardness")} className="block text-sm font-medium text-ink">
            Hardness (Mohs)
          </label>
          <input id={field("hardness")} name="hardness" maxLength={40} defaultValue={values.hardness} className="w-full rounded-md border border-line bg-surface-raised px-3 py-2 text-sm" />
        </div>
        <div className="space-y-1">
          <label htmlFor={field("sortOrder")} className="block text-sm font-medium text-ink">
            Sort order
          </label>
          <p className="text-xs text-ink-soft">Lower numbers appear first in the library.</p>
          <input id={field("sortOrder")} name="sortOrder" type="number" min={0} max={1000} defaultValue={values.sortOrder} className="w-full rounded-md border border-line bg-surface-raised px-3 py-2 text-sm" />
        </div>
        <div className="space-y-1 md:col-span-2">
          <label htmlFor={field("metaDescription")} className="block text-sm font-medium text-ink">
            Search description
          </label>
          <input id={field("metaDescription")} name="metaDescription" maxLength={160} defaultValue={values.metaDescription} className="w-full rounded-md border border-line bg-surface-raised px-3 py-2 text-sm" />
        </div>
      </fieldset>

      {REFERENCE_SECTIONS.map((section) => (
        <MarkdownEditor
          key={section.key}
          name={section.key}
          label={section.heading}
          defaultValue={values.sections[section.key]}
          rows={6}
        />
      ))}

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
