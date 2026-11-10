import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { DemoNotice, JsonLd, NewsletterSlot, ProseHtml } from "@/components/content/content-ui";
import { appUrl } from "@/lib/config/app-url";
import { buildReferenceSections } from "@/lib/content/reference-sections";
import { findPublicReferenceEntry } from "@/lib/content/service";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const entry = await findPublicReferenceEntry(slug);
  if (!entry) return { title: "Not found" };
  const description = entry.metaDescription ?? entry.summary;
  return { title: `${entry.name} reference`, description, openGraph: { title: `${entry.name} reference`, description } };
}

export default function ReferenceEntryPage({ params }: Props) {
  return (
    <Suspense fallback={null}>
      <ReferenceEntry params={params} />
    </Suspense>
  );
}

async function ReferenceEntry({ params }: Props) {
  const { slug } = await params;
  const entry = await findPublicReferenceEntry(slug);
  if (!entry) notFound();

  // Every section goes through renderMarkdown inside the builder. Empty sections are skipped below.
  const sections = buildReferenceSections(entry);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: `${entry.name} reference`,
    description: entry.metaDescription ?? entry.summary,
    url: appUrl(`/reference/${entry.slug}`),
  };

  return (
    <article className="mx-auto max-w-3xl space-y-10 px-4 py-10 sm:px-6">
      <JsonLd data={jsonLd} />
      <nav aria-label="Breadcrumb" className="text-sm text-ink-soft">
        <Link href="/reference" className="hover:text-ink">
          Gemstone Reference Library
        </Link>{" "}
        / <span className="text-ink">{entry.name}</span>
      </nav>

      <header className="space-y-4">
        <h1 className="font-heading text-4xl font-medium leading-[1.1] text-ink sm:text-5xl">{entry.name}</h1>
        <p className="text-lg text-ink-soft">{entry.summary}</p>
        <div className="flex flex-wrap items-center gap-3 text-sm text-ink-soft">
          {entry.hardness ? <span>Hardness: {entry.hardness}</span> : null}
          {entry.isDemo ? <DemoNotice /> : null}
        </div>
      </header>

      {sections
        .filter((section) => section.html !== "")
        .map((section) => (
          <section key={section.key} aria-labelledby={`section-${section.key}`} className="space-y-2">
            <h2 id={`section-${section.key}`} className="font-heading text-3xl font-medium text-ink">
              {section.heading}
            </h2>
            <ProseHtml html={section.html} />
          </section>
        ))}

      <section aria-labelledby="listings-heading" className="space-y-4 border border-line bg-surface-raised p-6">
        <h2 id="listings-heading" className="font-heading text-2xl text-ink">
          Find {entry.name.toLowerCase()} listings
        </h2>
        <p className="text-sm text-ink-soft">Browse listings from verified sellers in the matching catalogue category.</p>
        <div className="flex flex-wrap gap-3">
          <Link
            href={`/categories/${entry.categorySlug}`}
            className="inline-flex min-h-11 items-center justify-center bg-brand px-6 py-3 text-sm tracking-wide text-ivory transition duration-300 hover:bg-brand/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            View {entry.name} listings
          </Link>
          <Link
            href="/valuation"
            className="border border-line bg-surface px-5 py-3 text-sm font-medium text-ink hover:border-ink-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            Get an indicative valuation
          </Link>
        </div>
      </section>

      <NewsletterSlot source="reference" />
    </article>
  );
}
