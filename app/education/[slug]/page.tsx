import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArticleCard } from "@/components/content/article-card";
import { CoverImage, DemoNotice, formatPublishedDate, JsonLd, NewsletterSlot, ProseHtml } from "@/components/content/content-ui";
import { appUrl } from "@/lib/config/app-url";
import { coverUrl } from "@/lib/content/cover";
import { orderRelated } from "@/lib/content/related";
import { findPublicArticle, relatedArticles } from "@/lib/content/service";

type Props = { params: Promise<{ slug: string }> };

const TYPE_LABELS: Record<string, string> = { EDUCATION: "Education", GUIDE: "Guide", RESEARCH: "Research" };

/** Education, guide and research detail. Market news has its own route at /news. */
async function loadEducationArticle(slug: string) {
  const article = await findPublicArticle(slug);
  if (!article || article.type === "NEWS") return null;
  return article;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const article = await loadEducationArticle(slug);
  if (!article) return { title: "Not found" };
  const description = article.metaDescription ?? article.summary ?? undefined;
  return {
    title: article.title,
    description,
    openGraph: { title: article.title, description, type: "article", publishedTime: article.publishedAt?.toISOString() },
  };
}

export default function EducationArticlePage({ params }: Props) {
  return (
    <Suspense fallback={null}>
      <EducationArticle params={params} />
    </Suspense>
  );
}

async function EducationArticle({ params }: Props) {
  const { slug } = await params;
  const article = await loadEducationArticle(slug);
  if (!article) notFound();

  const related = orderRelated(article, await relatedArticles(article, 12), 3).filter((r) => r.type !== "NEWS");
  const published = formatPublishedDate(article.publishedAt);

  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.metaDescription ?? article.summary ?? undefined,
    datePublished: article.publishedAt?.toISOString(),
    dateModified: article.updatedAt.toISOString(),
    url: appUrl(`/education/${article.slug}`),
    publisher: { "@type": "Organization", name: "Gemstone Selections" },
    ...(article.coverKey ? { image: appUrl(coverUrl(article.coverKey)) } : {}),
  };

  return (
    <article className="mx-auto max-w-3xl space-y-8 px-4 py-10 sm:px-6">
      <JsonLd data={jsonLd} />
      <nav aria-label="Breadcrumb" className="text-sm text-ink-soft">
        <Link href="/education" className="hover:text-ink">
          Education and research
        </Link>{" "}
        / <span className="text-ink">{TYPE_LABELS[article.type] ?? "Article"}</span>
      </nav>

      <header className="space-y-4">
        <p className="text-xs font-medium uppercase tracking-wider text-accent">{TYPE_LABELS[article.type] ?? "Article"}</p>
        <h1 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">{article.title}</h1>
        {article.summary ? <p className="text-lg text-ink-soft">{article.summary}</p> : null}
        <p className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-ink-soft">
          {published ? <time dateTime={article.publishedAt?.toISOString()}>Published {published}</time> : null}
          <span>{article.readingMinutes} min read</span>
          {article.isDemo ? <DemoNotice /> : null}
        </p>
      </header>

      {article.coverKey ? <CoverImage coverKey={article.coverKey} alt={article.coverAlt} /> : null}

      <ProseHtml html={article.html} label={`Article: ${article.title}`} />

      {article.tags.length > 0 ? (
        <ul aria-label="Tags" className="flex flex-wrap gap-2">
          {article.tags.map((tag) => (
            <li key={tag}>
              <Link
                href={`/education?tag=${encodeURIComponent(tag)}`}
                className="rounded-full border border-line bg-surface-raised px-3 py-1 text-xs font-medium text-ink-soft hover:border-ink-soft hover:text-ink"
              >
                #{tag}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}

      <NewsletterSlot source="article" />

      {related.length > 0 ? (
        <section aria-labelledby="related-heading" className="space-y-4 border-t border-line pt-10">
          <h2 id="related-heading" className="text-xl font-semibold text-ink">
            Related reading
          </h2>
          <ul className="grid gap-5 md:grid-cols-3">
            {related.map((item) => (
              <li key={item.id}>
                <ArticleCard article={item} href={`/education/${item.slug}`} headingLevel={3} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </article>
  );
}
