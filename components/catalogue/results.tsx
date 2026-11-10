import Link from "next/link";
import type { ListingCard as ListingCardData } from "@/lib/listings/search";
import type { CatalogueQuery } from "@/lib/listings/schema";
import { ImpressionScope } from "@/components/analytics/track";
import { EmptyState } from "@/components/ui/empty-state";
import { ListingCard } from "./listing-card";
import { buildPageHref } from "./query-params";

const pageLink =
  "inline-flex min-h-11 items-center border border-line px-5 text-[13px] tracking-wide text-ink transition duration-300 hover:border-accent hover:text-accent-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

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
      <EmptyState
        title="No stones match these filters"
        body="Try a wider price range or fewer filters."
        action={
          <Link href={clearHref} className={pageLink}>
            Clear filters
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-4 text-[13px] text-ink-soft">
        <p>
          {total} {total === 1 ? "stone" : "stones"}
        </p>
        <p>
          Page {page} of {totalPages}
        </p>
      </div>

      <ImpressionScope>
        <ul className="grid grid-cols-1 gap-x-8 gap-y-14 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item, i) => (
            <li key={item.id}>
              <ListingCard listing={item} priority={i < 3} />
            </li>
          ))}
        </ul>
      </ImpressionScope>

      <nav aria-label="Pagination" className="flex items-center justify-between gap-4 text-sm">
        {page > 1 ? (
          <Link href={hrefFor(page - 1)} rel="prev" className={pageLink}>
            Previous
          </Link>
        ) : (
          <span />
        )}
        <span aria-hidden="true" />
        {page < totalPages ? (
          <Link href={hrefFor(page + 1)} rel="next" className={pageLink}>
            Next
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </div>
  );
}
