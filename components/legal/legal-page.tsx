import type { ReactNode } from "react";

/**
 * Shared layout for the four legal pages. Every page carries the draft banner until counsel has reviewed it.
 * Bracketed text such as [Company legal name] is a placeholder to replace from the signed-off document.
 */
export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <div role="note" className="mb-8 rounded-md border border-accent bg-accent-soft px-4 py-3 text-sm font-medium text-ink">
        Draft – needs legal review. Not for publication until counsel has approved this text.
      </div>
      <h1 className="text-3xl font-semibold tracking-tight text-ink">{title}</h1>
      <p className="mt-2 text-sm text-ink-soft">Last updated: {updated} (draft)</p>
      <div className="mt-8 flex flex-col gap-8 text-base leading-7 text-ink-soft [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-ink [&_ul]:list-disc [&_ul]:pl-6">
        {children}
      </div>
    </article>
  );
}

export function LegalSection({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2>{heading}</h2>
      {children}
    </section>
  );
}
