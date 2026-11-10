import { buttonClasses } from "@/components/ui/button";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { ArticleCard } from "@/components/content/article-card";
import { EmptyState, Pagination } from "@/components/content/content-ui";
import { cleanSearch, NEWS_CATEGORIES, pageCount, parseNewsCategory, parsePageNumber } from "@/lib/content/listing";
import { listPublicArticles } from "@/lib/content/service";

export const metadata: Metadata = {
  title: "Market news",
  description: "Gemstone market news with links to the original sources.",
};

const PER_PAGE = 12;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export default function NewsPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={null}>
      <NewsList searchParams={searchParams} />
    </Suspense>
  );
}

async function NewsList({ searchParams }: { searchParams: SearchParams }) {
  // Request-time: news is published on a schedule, so the list must not be frozen at build time.
  await connection();
  const sp = await searchParams;
  const category = parseNewsCategory(first(sp.category));
  const q = cleanSearch(first(sp.q));
  const page = parsePageNumber(first(sp.page));

  const { items, total } = await listPublicArticles({
    type: "NEWS",
    category: category ?? undefined,
    q: q || undefined,
    skip: (page - 1) * PER_PAGE,
    take: PER_PAGE,
  });
  const pages = pageCount(total, PER_PAGE);
  const baseParams = { category: category ?? undefined, q: q || undefined };
  const noFilters = !category && !q;

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-10 sm:px-6">
      <header className="max-w-3xl space-y-3">
        <h1 className="font-heading text-4xl font-medium leading-[1.1] text-ink sm:text-5xl">Market news</h1>
        <p className="text-ink-soft">
          Short summaries of gemstone market news. Each item names its source and links to the original report, which is
          the place to read the full story.
        </p>
      </header>

      <nav aria-label="News categories" className="flex flex-wrap gap-2">
        <Link
          href="/news"
          aria-current={!category ? "page" : undefined}
          className={`border px-4 py-1.5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
            !category ? "border-ink bg-ink text-surface-raised" : "border-line bg-surface-raised text-ink hover:border-ink-soft"
          }`}
        >
          All news
        </Link>
        {NEWS_CATEGORIES.map((option) => {
          const active = option === category;
          const params = new URLSearchParams({ category: option, ...(q ? { q } : {}) });
          return (
            <Link
              key={option}
              href={`/news?${params.toString()}`}
              aria-current={active ? "page" : undefined}
              className={`border px-4 py-1.5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                active ? "border-ink bg-ink text-surface-raised" : "border-line bg-surface-raised text-ink hover:border-ink-soft"
              }`}
            >
              {option}
            </Link>
          );
        })}
      </nav>

      <form action="/news" method="get" role="search" className="flex flex-col gap-2 sm:flex-row sm:items-end">
        {category ? <input type="hidden" name="category" value={category} /> : null}
        <div className="min-w-0 flex-1">
          <label htmlFor="news-search" className="text-sm font-medium text-ink">
            Search market news
          </label>
          <input
            id="news-search"
            type="search"
            name="q"
            maxLength={120}
            defaultValue={q}
            className="mt-1 min-h-11 w-full border border-line bg-surface-raised px-4 py-2.5 text-sm text-ink placeholder:text-ink-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            placeholder="Search by title or word"
          />
        </div>
        <button type="submit" className={buttonClasses({ className: "min-h-11 px-6" })}>
          Search
        </button>
      </form>

      {items.length === 0 ? (
        <EmptyState
          title={noFilters ? "Nothing published yet" : "No matching news"}
          body={noFilters ? "No market news has been published yet. Check back soon." : "Try another category or word."}
        />
      ) : (
        <ul className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <li key={item.id}>
              <ArticleCard article={item} href={`/news/${item.slug}`} />
            </li>
          ))}
        </ul>
      )}

      <Pagination basePath="/news" params={baseParams} page={Math.min(page, pages)} pageCount={pages} />
      <p className="sr-only" aria-live="polite">
        {total} news item{total === 1 ? "" : "s"} found
      </p>
    </div>
  );
}
