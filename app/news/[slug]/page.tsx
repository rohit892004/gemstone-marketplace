import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArticleCard } from "@/components/content/article-card";
import { CoverImage, DemoNotice, formatPublishedDate, JsonLd, NewsletterSlot, ProseHtml } from "@/components/content/content-ui";
import { appUrl } from "@/lib/config/app-url";
import { orderRelated } from "@/lib/content/related";
import { findPublicArticle, relatedArticles } from "@/lib/content/service";
import { isHttpsUrl } from "@/lib/content/status";

type Props = { params: Promise<{ slug: string }> };

/** Market news only. Education and guide pages live under /education. */
async function loadNewsItem(slug: string) {
  const item = await findPublicArticle(slug);
  if (!item || item.type !== "NEWS") return null;
  return item;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const item = await loadNewsItem(slug);
  if (!item) return { title: "Not found" };
  const description = item.metaDescription ?? item.summary ?? undefined;
  return { title: item.title, description, openGraph: { title: item.title, description, type: "article", publishedTime: item.publishedAt?.toISOString() } };
}

export default function NewsItemPage({ params }: Props) {
  return (
    <Suspense fallback={null}>
      <NewsItem params={params} />
    </Suspense>
  );
}

async function NewsItem({ params }: Props) {
  const { slug } = await params;
  const item = await loadNewsItem(slug);
  if (!item) notFound();

  const related = orderRelated(item, await relatedArticles(item, 12), 3).filter((r) => r.type === "NEWS");
  const published = formatPublishedDate(item.publishedAt);

  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: item.title,
    description: item.summary ?? undefined,
    datePublished: item.publishedAt?.toISOString(),
    dateModified: item.updatedAt.toISOString(),
    url: appUrl(`/news/${item.slug}`),
    publisher: { "@type": "Organization", name: "Gemstone Selections" },
    ...(item.sourceName ? { citation: item.sourceName } : {}),
    ...(item.coverKey ? { image: appUrl(`/content-media/${item.coverKey}`) } : {}),
  };

  return (
    <article className="mx-auto max-w-3xl space-y-8 px-4 py-10 sm:px-6">
      <JsonLd data={jsonLd} />
      <nav aria-label="Breadcrumb" className="text-sm text-ink-soft">
        <Link href="/news" className="hover:text-ink">
          Market news
        </Link>{" "}
        / <span className="text-ink">{item.category ?? "News"}</span>
      </nav>

      <header className="space-y-4">
        <p className="flex flex-wrap items-center gap-2 text-xs font-medium uppercase tracking-wider text-accent">
          {item.category ? <span>{item.category}</span> : <span>Market news</span>}
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">{item.title}</h1>
        {item.summary ? <p className="text-lg text-ink-soft">{item.summary}</p> : null}
        <p className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-ink-soft">
          {published ? <time dateTime={item.publishedAt?.toISOString()}>{published}</time> : null}
          {item.isDemo ? <DemoNotice /> : null}
        </p>
      </header>

      {item.sourceName && item.sourceUrl && isHttpsUrl(item.sourceUrl) ? (
        <aside aria-label="Source" className="rounded-lg border border-line bg-surface-raised p-4 text-sm text-ink-soft">
          Source: <span className="font-medium text-ink">{item.sourceName}</span>.{" "}
          <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer nofollow" className="font-medium text-brand-strong underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
            Read the original report<span className="sr-only"> (opens in a new tab)</span>
          </a>
          .
        </aside>
      ) : null}

      {item.coverKey ? <CoverImage coverKey={item.coverKey} alt={item.coverAlt} /> : null}

      <ProseHtml html={item.html} label={`News: ${item.title}`} />

      <NewsletterSlot source="news" />

      {related.length > 0 ? (
        <section aria-labelledby="related-news-heading" className="space-y-4 border-t border-line pt-10">
          <h2 id="related-news-heading" className="text-xl font-semibold text-ink">
            More market news
          </h2>
          <ul className="grid gap-5 md:grid-cols-3">
            {related.map((other) => (
              <li key={other.id}>
                <ArticleCard article={other} href={`/news/${other.slug}`} headingLevel={3} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </article>
  );
}
