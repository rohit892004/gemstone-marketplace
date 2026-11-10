import type { CatalogueQuery } from "@/lib/listings/schema";
import { CURRENCIES } from "@/lib/money/money";
import { Input, Select } from "@/components/ui/field";
import { buttonClasses } from "@/components/ui/button";

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

const labelClass = "block text-[13px] tracking-wide text-ink";
const legendClass = "text-[13px] tracking-wide text-ink";
const groupClass = "space-y-2";

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
    <form method="get" action={action} className="space-y-6 border border-line bg-surface-raised p-6">
      <div className={groupClass}>
        <label htmlFor="f-q" className={labelClass}>
          Search
        </label>
        <Input id="f-q" name="q" type="search" defaultValue={query.q ?? ""} maxLength={120} placeholder="Stone, origin, seller or city" />
      </div>

      {showCategory ? (
        <div className={groupClass}>
          <label htmlFor="f-category" className={labelClass}>
            Category
          </label>
          <Select id="f-category" name="category" defaultValue={query.category ?? ""}>
            <option value="">All categories</option>
            {facets.categories.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
      ) : null}

      <div className={groupClass}>
        <label htmlFor="f-type" className={labelClass}>
          Gemstone type
        </label>
        <Select id="f-type" name="type" defaultValue={query.type ?? ""}>
          <option value="">All types</option>
          {facets.species.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
      </div>

      <div className={groupClass}>
        <label htmlFor="f-shape" className={labelClass}>
          Shape
        </label>
        <Select id="f-shape" name="shape" defaultValue={query.shape ?? ""}>
          <option value="">All shapes</option>
          {facets.shapes.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
      </div>

      <fieldset className={groupClass}>
        <legend className={legendClass}>Carat weight</legend>
        <div className="grid grid-cols-2 gap-2">
          <Input aria-label="Minimum carat" name="minCarat" type="number" min={0} step="0.01" defaultValue={query.minCarat ?? ""} placeholder="Min" />
          <Input aria-label="Maximum carat" name="maxCarat" type="number" min={0} step="0.01" defaultValue={query.maxCarat ?? ""} placeholder="Max" />
        </div>
      </fieldset>

      <fieldset className={groupClass}>
        <legend className={legendClass}>Price (major units)</legend>
        <Select aria-label="Currency" name="currency" defaultValue={query.currency ?? ""}>
          <option value="">Any currency</option>
          {CURRENCIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
        <div className="grid grid-cols-2 gap-2">
          <Input aria-label="Minimum price" name="minPrice" type="number" min={0} step="0.01" defaultValue={query.minPrice ?? ""} placeholder="Min" />
          <Input aria-label="Maximum price" name="maxPrice" type="number" min={0} step="0.01" defaultValue={query.maxPrice ?? ""} placeholder="Max" />
        </div>
      </fieldset>

      <div className={groupClass}>
        <label htmlFor="f-origin" className={labelClass}>
          Origin
        </label>
        <Input id="f-origin" name="origin" type="text" maxLength={80} defaultValue={query.origin ?? ""} />
      </div>

      <div className={groupClass}>
        <label htmlFor="f-treatment" className={labelClass}>
          Treatment
        </label>
        <Input id="f-treatment" name="treatment" type="text" maxLength={120} defaultValue={query.treatment ?? ""} />
      </div>

      <div className="flex min-h-11 items-center gap-3">
        <input
          id="f-certified"
          name="certified"
          type="checkbox"
          value="yes"
          defaultChecked={query.certified === "yes"}
          className="h-5 w-5 accent-accent"
        />
        <label htmlFor="f-certified" className="text-[14px] text-ink">
          Lab-certified only
        </label>
      </div>

      <div className={groupClass}>
        <label htmlFor="f-availability" className={labelClass}>
          Availability
        </label>
        <Select id="f-availability" name="availability" defaultValue={query.availability ?? ""}>
          {AVAILABILITY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      </div>

      <div className={groupClass}>
        <label htmlFor="f-sort" className={labelClass}>
          Sort by
        </label>
        <Select id="f-sort" name="sort" defaultValue={query.sort}>
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex flex-col gap-3">
        <button type="submit" className={buttonClasses({ variant: "primary", size: "lg", block: true })}>
          Apply filters
        </button>
        <a
          href={clearHref}
          className="inline-flex min-h-11 items-center justify-center text-[13px] tracking-wide text-ink-soft underline underline-offset-4 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Clear filters
        </a>
      </div>
    </form>
  );
}
