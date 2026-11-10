import { Children, isValidElement, type ReactNode } from "react";
import { PageHeader } from "@/components/ui/page-header";

/**
 * Shared layout for the four legal pages. Every page carries the draft note until counsel has reviewed it.
 * Bracketed text such as [Company legal name] is a placeholder to replace from the signed-off document.
 * The contents list is built from the LegalSection headings, so the two always match.
 */
export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  const contents = Children.toArray(children).flatMap((child) =>
    isValidElement<{ heading?: unknown }>(child) && typeof child.props.heading === "string"
      ? [{ id: sectionId(child.props.heading), label: child.props.heading }]
      : [],
  );

  return (
    <article className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <div role="note" className="mb-10 max-w-3xl border border-accent/60 bg-accent-soft px-4 py-3 text-sm font-medium text-ink">
        Draft – needs legal review. Not for publication until counsel has approved this text.
      </div>

      <PageHeader eyebrow="Legal" title={title} lead={<>Last updated: {updated} (draft)</>} />

      <div className="grid gap-10 lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-16">
        {contents.length > 0 ? (
          <nav aria-label="Contents" className="lg:sticky lg:top-28 lg:self-start">
            <p className="text-[11px] uppercase tracking-[0.28em] text-ink-soft" aria-hidden>
              Contents
            </p>
            <ol className="mt-4 grid border-t border-line sm:grid-cols-2 lg:grid-cols-1">
              {contents.map((item) => (
                <li key={item.id} className="border-b border-line">
                  <a
                    href={`#${item.id}`}
                    className="flex min-h-11 items-center py-2 text-sm text-ink-soft transition duration-300 hover:text-ink hover:underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        ) : null}

        <div className="flex min-w-0 max-w-prose flex-col gap-10 text-base leading-7 text-ink-soft [&_h2]:font-heading [&_h2]:text-2xl [&_h2]:font-medium [&_h2]:text-ink [&_ul]:list-disc [&_ul]:pl-6">
          {children}
        </div>
      </div>
    </article>
  );
}

/** Anchor id for a section heading. Used by both the contents list and the section itself. */
export function sectionId(heading: string): string {
  const slug = heading
    .toLowerCase()
    .replace(/&[a-z]+;/g, " ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `section-${slug}`;
}

export function LegalSection({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section id={sectionId(heading)} className="flex scroll-mt-28 flex-col gap-3">
      <h2>{heading}</h2>
      {children}
    </section>
  );
}
