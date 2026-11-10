import type { Metadata } from "next";
import { Suspense } from "react";
import { TrackSearch } from "@/components/analytics/track";
import { CatalogueFilters } from "@/components/catalogue/filters";
import { CatalogueResults } from "@/components/catalogue/results";
import { type RawSearchParams, parseCatalogueParams } from "@/components/catalogue/query-params";
import { PageHeader } from "@/components/ui/page-header";
import { searchCatalogue } from "@/lib/listings/search";
import { getCatalogueFacets } from "@/lib/seller-public/facets";

export const metadata: Metadata = {
  title: "Gemstones",
  description: "Browse certified and verified gemstones from approved sellers.",
};

export default function GemstonesPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16">
      <PageHeader
        eyebrow="The collection"
        title="Gemstones"
        lead="Stones listed by approved sellers. Filter by type, carat, price and certification."
      />
      <Suspense fallback={null}>
        <GemstonesResults searchParams={searchParams} />
      </Suspense>
    </section>
  );
}

async function GemstonesResults({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const query = parseCatalogueParams(await searchParams);
  const [result, facets] = await Promise.all([searchCatalogue(query), getCatalogueFacets()]);

  return (
    <div className="grid gap-10 lg:grid-cols-[18rem_1fr]">
      <TrackSearch term={query.q} />
      <aside aria-label="Filters" className="lg:sticky lg:top-10 lg:self-start">
        <CatalogueFilters action="/gemstones" query={query} facets={facets} showCategory clearHref="/gemstones" />
      </aside>
      <div className="min-w-0">
        <CatalogueResults
          items={result.items}
          total={result.total}
          page={result.page}
          pageSize={result.pageSize}
          query={query}
          basePath="/gemstones"
          clearHref="/gemstones"
        />
      </div>
    </div>
  );
}
