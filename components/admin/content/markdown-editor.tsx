"use client";

import { useEffect, useId, useState } from "react";
import { previewMarkdown } from "@/app/admin/content/actions";
import { ProseHtml } from "@/components/content/content-ui";

const DEBOUNCE_MS = 350;

interface MarkdownEditorProps {
  name: string;
  label: string;
  defaultValue: string;
  rows?: number;
  required?: boolean;
  help?: string;
}

/**
 * Markdown textarea with a live preview. The preview is rendered on the server by the same renderMarkdown the public
 * site uses. Requests are debounced, and a stale response never overwrites a newer one.
 */
export function MarkdownEditor({ name, label, defaultValue, rows = 12, required, help }: MarkdownEditorProps) {
  const id = useId();
  const [value, setValue] = useState(defaultValue);
  const [html, setHtml] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      previewMarkdown(value).then(
        (result) => {
          if (cancelled) return;
          if ("html" in result) {
            setHtml(result.html);
            setPreviewError(null);
          } else {
            setPreviewError(result.error);
          }
        },
        () => {
          if (!cancelled) setPreviewError("The preview is not available right now.");
        },
      );
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [value]);

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <div className="space-y-2">
        <label htmlFor={id} className="block text-[13px] tracking-wide text-ink">
          {label}
        </label>
        {help ? (
          <p id={`${id}-help`} className="text-[12px] text-ink-soft">
            {help}
          </p>
        ) : null}
        <textarea
          id={id}
          name={name}
          rows={rows}
          required={required}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          aria-describedby={help ? `${id}-help` : undefined}
          spellCheck
          className="block w-full border border-line bg-surface-raised px-4 py-3 font-mono text-[14px] text-ink transition duration-300 focus:border-accent focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        />
        <p className="text-[12px] text-ink-soft">Markdown: ## headings, **bold**, *italic*, [links](https://...), - lists. Raw HTML is shown as text.</p>
      </div>
      <section aria-labelledby={`${id}-preview`} className="space-y-2">
        <h3 id={`${id}-preview`} className="text-[13px] tracking-wide text-ink">
          Live preview
        </h3>
        <div aria-live="polite" className="min-h-32 border border-dashed border-line bg-surface p-5">
          {previewError ? <p className="text-sm text-danger">{previewError}</p> : null}
          {!previewError && html !== null ? (
            html.trim() === "" ? (
              <p className="text-sm text-ink-soft">Nothing to preview yet.</p>
            ) : (
              <ProseHtml html={html} label={`Preview of ${label}`} />
            )
          ) : null}
        </div>
      </section>
    </div>
  );
}
