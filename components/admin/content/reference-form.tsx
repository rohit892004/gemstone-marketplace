"use client";

import { useActionState, useId } from "react";
import type { ContentActionState } from "@/app/admin/content/actions";
import { MarkdownEditor } from "@/components/admin/content/markdown-editor";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/field";
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

const LABEL = "block text-[13px] tracking-wide text-ink";
const HINT = "text-[12px] text-ink-soft";

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
    <form action={formAction} className="space-y-8" aria-label="Reference page content">
      {values.id ? <input type="hidden" name="id" value={values.id} /> : null}

      <fieldset className="grid gap-6 md:grid-cols-2">
        <legend className="sr-only">Gemstone details</legend>
        <div className="space-y-2">
          <label htmlFor={field("name")} className={LABEL}>
            Gemstone name
          </label>
          <Input id={field("name")} name="name" required maxLength={120} defaultValue={values.name} />
        </div>
        <div className="space-y-2">
          <label htmlFor={field("categorySlug")} className={LABEL}>
            Catalogue category
          </label>
          <p className={HINT}>Links this page to the matching listings and the valuation form.</p>
          <Select id={field("categorySlug")} name="categorySlug" required defaultValue={values.categorySlug}>
            <option value="" disabled>
              Choose a category
            </option>
            {categories.map((category) => (
              <option key={category.slug} value={category.slug}>
                {category.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-2 md:col-span-2">
          <label htmlFor={field("summary")} className={LABEL}>
            Summary
          </label>
          <Textarea id={field("summary")} name="summary" required rows={2} maxLength={SUMMARY_MAX} defaultValue={values.summary} />
        </div>
        <div className="space-y-2">
          <label htmlFor={field("hardness")} className={LABEL}>
            Hardness (Mohs)
          </label>
          <Input id={field("hardness")} name="hardness" maxLength={40} defaultValue={values.hardness} />
        </div>
        <div className="space-y-2">
          <label htmlFor={field("sortOrder")} className={LABEL}>
            Sort order
          </label>
          <p className={HINT}>Lower numbers appear first in the library.</p>
          <Input id={field("sortOrder")} name="sortOrder" type="number" min={0} max={1000} defaultValue={values.sortOrder} />
        </div>
        <div className="space-y-2 md:col-span-2">
          <label htmlFor={field("metaDescription")} className={LABEL}>
            Search description
          </label>
          <Input id={field("metaDescription")} name="metaDescription" maxLength={160} defaultValue={values.metaDescription} />
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

      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving..." : values.id ? "Save draft" : "Create draft"}
        </Button>
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
      </div>
    </form>
  );
}
