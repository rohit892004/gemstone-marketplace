import type { CatalogueQuery } from "@/lib/listings/schema";
import { CURRENCIES } from "@/lib/money/money";

export interface FilterFacets {
  categories: { name: string; slug: string }[];
  species: string[];
  shapes: string[];
}

const AVAILABILITY_OPTIONS = [
  { value: "", label: "Available and reserved" },
  { value: "AVAILABLE", label: "Available" },
  { value: "RESERVED", label: "Reserved" },
  { value: "SOLD", label: "Sold" },
] as const;

const SORT_OPTIONS = [
  { value: "newest", label: "Newest" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
  { value: "carat_desc", label: "Carat: high to low" },
  { value: "relevance", label: "Relevance" },
] as const;

const fieldClass =
  "mt-1 w-full rounded-md border border-line bg-surface-raised px-3 py-2 text-sm text-ink focus-visible:outline-2";
const labelClass = "block text-sm font-medium text-ink";

/**
 * Plain GET form. Every control has a name that matches a URL parameter, so the filters
 * work without JavaScript. Submitting drops the page number (back to page 1).
 */
export function CatalogueFilters({
  action,
  query,
  facets,
  showCategory,
  clearHref,
}: {
  action: string;
  query: CatalogueQuery;
  facets: FilterFacets;
  showCategory: boolean;
  clearHref: string;
}) {
  return (
    <form method="get" action={action} className="space-y-5 rounded-lg border border-line bg-surface-raised p-5">
      <div>
        <label htmlFor="f-q" className={labelClass}>
          Search
        </label>
        <input
          id="f-q"
          name="q"
          type="search"
          defaultValue={query.q ?? ""}
          maxLength={120}
          placeholder="Stone, origin, seller or city"
          className={fieldClass}
        />
      </div>

      {showCategory ? (
        <div>
          <label htmlFor="f-category" className={labelClass}>
            Category
          </label>
          <select id="f-category" name="category" defaultValue={query.category ?? ""} className={fieldClass}>
            <option value="">All categories</option>
            {facets.categories.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div>
        <label htmlFor="f-type" className={labelClass}>
          Gemstone type
        </label>
        <select id="f-type" name="type" defaultValue={query.type ?? ""} className={fieldClass}>
          <option value="">All types</option>
          {facets.species.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="f-shape" className={labelClass}>
          Shape
        </label>
        <select id="f-shape" name="shape" defaultValue={query.shape ?? ""} className={fieldClass}>
          <option value="">All shapes</option>
          {facets.shapes.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <fieldset>
        <legend className={labelClass}>Carat weight</legend>
        <div className="mt-1 grid grid-cols-2 gap-2">
          <input
            aria-label="Minimum carat"
            name="minCarat"
            type="number"
            min={0}
            step="0.01"
            defaultValue={query.minCarat ?? ""}
            placeholder="Min"
            className={fieldClass}
          />
          <input
            aria-label="Maximum carat"
            name="maxCarat"
            type="number"
            min={0}
            step="0.01"
            defaultValue={query.maxCarat ?? ""}
            placeholder="Max"
            className={fieldClass}
          />
        </div>
      </fieldset>

      <fieldset>
        <legend className={labelClass}>Price (major units)</legend>
        <div className="mt-1 space-y-2">
          <select aria-label="Currency" name="currency" defaultValue={query.currency ?? ""} className={fieldClass}>
            <option value="">Any currency</option>
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <input
              aria-label="Minimum price"
              name="minPrice"
              type="number"
              min={0}
              step="0.01"
              defaultValue={query.minPrice ?? ""}
              placeholder="Min"
              className={fieldClass}
            />
            <input
              aria-label="Maximum price"
              name="maxPrice"
              type="number"
              min={0}
              step="0.01"
              defaultValue={query.maxPrice ?? ""}
              placeholder="Max"
              className={fieldClass}
            />
          </div>
        </div>
      </fieldset>

      <div>
        <label htmlFor="f-origin" className={labelClass}>
          Origin
        </label>
        <input id="f-origin" name="origin" type="text" maxLength={80} defaultValue={query.origin ?? ""} className={fieldClass} />
      </div>

      <div>
        <label htmlFor="f-treatment" className={labelClass}>
          Treatment
        </label>
        <input
          id="f-treatment"
          name="treatment"
          type="text"
          maxLength={120}
          defaultValue={query.treatment ?? ""}
          className={fieldClass}
        />
      </div>

      <div className="flex items-center gap-2">
        <input
          id="f-certified"
          name="certified"
          type="checkbox"
          value="yes"
          defaultChecked={query.certified === "yes"}
          className="size-4"
        />
        <label htmlFor="f-certified" className="text-sm text-ink">
          Lab-certified only
        </label>
      </div>

      <div>
        <label htmlFor="f-availability" className={labelClass}>
          Availability
        </label>
        <select
          id="f-availability"
          name="availability"
          defaultValue={query.availability ?? ""}
          className={fieldClass}
        >
          {AVAILABILITY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="f-sort" className={labelClass}>
          Sort by
        </label>
        <select id="f-sort" name="sort" defaultValue={query.sort} className={fieldClass}>
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-strong focus-visible:outline-2"
        >
          Apply filters
        </button>
        <a href={clearHref} className="text-sm text-ink-soft underline underline-offset-4 hover:text-ink">
          Clear filters
        </a>
      </div>
    </form>
  );
}
