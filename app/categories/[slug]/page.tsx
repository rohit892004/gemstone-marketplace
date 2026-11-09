import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CatalogueFilters } from "@/components/catalogue/filters";
import { CatalogueResults } from "@/components/catalogue/results";
import { type RawSearchParams, parseCatalogueParams } from "@/components/catalogue/query-params";
import { prisma } from "@/lib/db/client";
import { searchCatalogue } from "@/lib/listings/search";
import { getCatalogueFacets } from "@/lib/seller-public/facets";
import { categoryIntro } from "../intros";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<RawSearchParams> };

export default function CategoryPage({ params, searchParams }: Props) {
  return (
    <Suspense fallback={null}>
      <CategoryContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function loadCategory(slug: string) {
  return prisma.category.findUnique({ where: { slug }, select: { name: true, slug: true } });
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const category = await loadCategory(slug);
  if (!category) return { title: "Category not found" };
  return {
    title: category.name,
    description: categoryIntro(category.slug, category.name),
  };
}

async function CategoryContent({ params, searchParams }: Props) {
  const { slug } = await params;
  const category = await loadCategory(slug);
  if (!category) notFound();

  const query = parseCatalogueParams(await searchParams, { category: category.slug });
  const [result, facets] = await Promise.all([searchCatalogue(query), getCatalogueFacets()]);
  const basePath = `/categories/${category.slug}`;

  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-ink-soft">
        <Link href="/gemstones" className="hover:text-ink">
          Gemstones
        </Link>{" "}
        / <span className="text-ink">{category.name}</span>
      </nav>
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">{category.name}</h1>
        <p className="mt-2 max-w-3xl text-ink-soft">{categoryIntro(category.slug, category.name)}</p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[18rem_1fr]">
        <aside aria-label="Filters">
          <CatalogueFilters
            action={basePath}
            query={query}
            facets={facets}
            showCategory={false}
            clearHref={basePath}
          />
        </aside>
        <div>
          <CatalogueResults
            items={result.items}
            total={result.total}
            page={result.page}
            pageSize={result.pageSize}
            query={query}
            basePath={basePath}
            omit={["category"]}
            clearHref={basePath}
          />
        </div>
      </div>
    </section>
  );
}
