import { buttonClasses } from "@/components/ui/button";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { ArticleCard } from "@/components/content/article-card";
import { EmptyState, Pagination } from "@/components/content/content-ui";
import { cleanSearch, cleanTag, EDUCATION_TABS, educationTabFilter, pageCount, parseEducationTab, parsePageNumber } from "@/lib/content/listing";
import { listPublicArticles } from "@/lib/content/service";

export const metadata: Metadata = {
  title: "Education and research",
  description: "Plain-language guides and research on gemstone grading, treatments, care and buying with confidence.",
};

const PER_PAGE = 9;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export default function EducationPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={null}>
      <EducationList searchParams={searchParams} />
    </Suspense>
  );
}

async function EducationList({ searchParams }: { searchParams: SearchParams }) {
  // Request-time: the list must show content as soon as it is published or scheduled to publish.
  await connection();
  const sp = await searchParams;
  const tab = parseEducationTab(first(sp.tab));
  const q = cleanSearch(first(sp.q));
  const tag = cleanTag(first(sp.tag));
  const page = parsePageNumber(first(sp.page));

  const { items, total } = await listPublicArticles({
    ...educationTabFilter(tab),
    tag: tag ?? undefined,
    q: q || undefined,
    skip: (page - 1) * PER_PAGE,
    take: PER_PAGE,
  });
  const pages = pageCount(total, PER_PAGE);
  const filters = { tab: tab.id === "all" ? undefined : tab.id, q: q || undefined, tag: tag ?? undefined };

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-10 sm:px-6">
      <header className="max-w-3xl space-y-3">
        <h1 className="font-heading text-4xl font-medium leading-[1.1] text-ink sm:text-5xl">Education and research</h1>
        <p className="text-ink-soft">
          Guides on grading, treatments and care, and research notes on the gemstone market. Everything here is written to
          help you ask better questions when you buy or value a stone.
        </p>
      </header>

      <nav aria-label="Content type" className="flex flex-wrap gap-2">
        {EDUCATION_TABS.map((option) => {
          const active = option.id === tab.id;
          const href = option.id === "all" ? "/education" : `/education?tab=${option.id}`;
          return (
            <Link
              key={option.id}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`border px-4 py-1.5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                active ? "border-ink bg-ink text-surface-raised" : "border-line bg-surface-raised text-ink hover:border-ink-soft"
              }`}
            >
              {option.label}
            </Link>
          );
        })}
      </nav>

      <form action="/education" method="get" role="search" className="flex flex-col gap-2 sm:flex-row sm:items-end">
        {filters.tab ? <input type="hidden" name="tab" value={filters.tab} /> : null}
        {filters.tag ? <input type="hidden" name="tag" value={filters.tag} /> : null}
        <div className="min-w-0 flex-1">
          <label htmlFor="education-search" className="text-sm font-medium text-ink">
            Search education and research
          </label>
          <input
            id="education-search"
            type="search"
            name="q"
            maxLength={120}
            defaultValue={q}
            className="mt-1 min-h-11 w-full border border-line bg-surface-raised px-4 py-2.5 text-sm text-ink placeholder:text-ink-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            placeholder="Search by title, topic or word"
          />
        </div>
        <button type="submit" className={buttonClasses({ className: "min-h-11 px-6" })}>
          Search
        </button>
      </form>

      {tag ? (
        <p className="text-sm text-ink-soft">
          Showing items tagged <span className="font-medium text-ink">{tag}</span>.{" "}
          <Link href={tab.id === "all" ? "/education" : `/education?tab=${tab.id}`} className="underline hover:text-ink">
            Clear tag
          </Link>
        </p>
      ) : null}

      {items.length === 0 ? (
        <EmptyState
          title={total === 0 && !q && !tag ? "Nothing published yet" : "No matches"}
          body={
            total === 0 && !q && !tag
              ? "Our team is writing the first guides. Check back soon, or browse the catalogue in the meantime."
              : "Try a different word, or clear the search and filters."
          }
        />
      ) : (
        <ul className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {items.map((article) => (
            <li key={article.id}>
              <ArticleCard article={article} href={`/education/${article.slug}`} />
            </li>
          ))}
        </ul>
      )}

      <Pagination basePath="/education" params={{ ...filters, page: undefined }} page={Math.min(page, pages)} pageCount={pages} />
      <p className="sr-only" aria-live="polite">
        {total} item{total === 1 ? "" : "s"} found
      </p>
    </div>
  );
}
