import Link from "next/link";
import { coverUrl } from "@/lib/content/cover";
import { DEMO_LABEL } from "@/lib/demo/guard";
import { NewsletterSignup } from "@/components/newsletter/newsletter-signup";

/** Shown on every demo item, public and admin. Demo content needs expert review before anyone relies on it. */
export function DemoNotice({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border border-dashed border-ink-soft/50 bg-surface px-2.5 py-0.5 text-xs font-medium text-ink-soft ${className}`}
    >
      {DEMO_LABEL} – needs expert review
    </span>
  );
}

/** Rendered HTML from renderMarkdown only. Callers must not pass HTML from anywhere else. */
export function ProseHtml({ html, label }: { html: string; label?: string }) {
  return (
    <div
      aria-label={label}
      className="max-w-prose text-base leading-7 text-ink [&_a]:text-brand-strong [&_a]:underline [&_blockquote]:border-l-4 [&_blockquote]:border-line [&_blockquote]:pl-4 [&_blockquote]:text-ink-soft [&_code]:rounded [&_code]:bg-surface-raised [&_code]:px-1 [&_h2]:mt-10 [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h3]:mt-8 [&_h3]:text-xl [&_h3]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_ol>li]:list-decimal [&_p]:mt-4 [&_strong]:font-semibold [&_ol]:mt-4 [&_ul]:mt-4"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export function CoverImage({ coverKey, alt, className = "" }: { coverKey: string | null; alt: string | null; className?: string }) {
  if (!coverKey) return null;
  // Alt text is required for covers. Empty alt is only used when the editor has not supplied any text.
  return (
    // eslint-disable-next-line @next/next/no-img-element -- served by our own route with no optimiser
    <img src={coverUrl(coverKey)} alt={alt ?? ""} loading="lazy" className={`aspect-[16/9] w-full rounded-lg object-cover ${className}`} />
  );
}

export function formatPublishedDate(date: Date | null): string {
  if (!date) return "";
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(date);
}

/** Serialises JSON-LD safely inside a script tag (escapes "<" so no tag can close the script early). */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}

interface PaginationProps {
  basePath: string;
  params: Record<string, string | undefined>;
  page: number;
  pageCount: number;
}

/** Previous and next links that keep the other query parameters. Works without JavaScript. */
export function Pagination({ basePath, params, page, pageCount }: PaginationProps) {
  if (pageCount <= 1) return null;
  const href = (target: number) => {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) if (value) search.set(key, value);
    if (target > 1) search.set("page", String(target));
    const query = search.toString();
    return query ? `${basePath}?${query}` : basePath;
  };
  const linkClass = "rounded-md border border-line bg-surface-raised px-4 py-2 text-sm font-medium text-ink hover:border-ink-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";
  return (
    <nav aria-label="Pagination" className="mt-10 flex items-center justify-between gap-4">
      {page > 1 ? (
        <Link href={href(page - 1)} rel="prev" className={linkClass}>
          Previous
        </Link>
      ) : (
        <span />
      )}
      <p className="text-sm text-ink-soft">
        Page {page} of {pageCount}
      </p>
      {page < pageCount ? (
        <Link href={href(page + 1)} rel="next" className={linkClass}>
          Next
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}

/** Empty state for list pages. */
export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-dashed border-line bg-surface-raised p-8 text-center">
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
      <p className="mt-2 text-sm text-ink-soft">{body}</p>
    </div>
  );
}

/** Newsletter sign-up on article and reference pages. */
export function NewsletterSlot({ source }: { source: string }) {
  return <NewsletterSignup source={source} variant="inline" />;
}
