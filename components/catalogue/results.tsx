import Link from "next/link";
import type { ListingCard as ListingCardData } from "@/lib/listings/search";
import type { CatalogueQuery } from "@/lib/listings/schema";
import { ImpressionScope } from "@/components/analytics/track";
import { ListingCard } from "./listing-card";
import { buildPageHref } from "./query-params";

/** Result count, the card grid, the empty state and pagination links that keep the filters. */
export function CatalogueResults({
  items,
  total,
  page,
  pageSize,
  query,
  basePath,
  omit,
  clearHref,
}: {
  items: ListingCardData[];
  total: number;
  page: number;
  pageSize: number;
  query: CatalogueQuery;
  basePath: string;
  omit?: readonly ("category")[];
  clearHref: string;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const hrefFor = (p: number) => buildPageHref(basePath, query, p, { omit });

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-line bg-surface-raised p-8 text-center">
        <h2 className="text-lg font-semibold text-ink">No stones match these filters</h2>
        <p className="mt-2 text-sm text-ink-soft">Try a wider price range or fewer filters.</p>
        <Link href={clearHref} className="mt-4 inline-block text-sm font-medium text-brand-strong underline underline-offset-4">
          Clear filters
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-ink-soft">
        <p>
          {total} {total === 1 ? "stone" : "stones"}
        </p>
        <p>
          Page {page} of {totalPages}
        </p>
      </div>

      <ImpressionScope>
        <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item, i) => (
            <li key={item.id}>
              <ListingCard listing={item} priority={i < 3} />
            </li>
          ))}
        </ul>
      </ImpressionScope>

      <nav aria-label="Pagination" className="flex items-center justify-between gap-4 text-sm">
        {page > 1 ? (
          <Link href={hrefFor(page - 1)} rel="prev" className="rounded-md border border-line px-3 py-1.5 hover:border-ink-soft">
            Previous
          </Link>
        ) : (
          <span />
        )}
        <span aria-hidden="true" />
        {page < totalPages ? (
          <Link href={hrefFor(page + 1)} rel="next" className="rounded-md border border-line px-3 py-1.5 hover:border-ink-soft">
            Next
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </div>
  );
}
