import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { SellerCard } from "@/components/catalogue/seller-card";
import { type RawSearchParams } from "@/components/catalogue/query-params";
import { TierBadge } from "@/components/membership/tier-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Select } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { buttonClasses } from "@/components/ui/button";
import { listSpecialties, searchSellers } from "@/lib/seller-public/directory";

export const metadata: Metadata = {
  title: "Sellers",
  description: "Approved gemstone sellers. Search by business name, city or state, and filter by specialty.",
};

const pageLink =
  "inline-flex min-h-11 items-center border border-line px-5 text-[13px] tracking-wide text-ink transition duration-300 hover:border-accent hover:text-accent-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const labelClass = "block text-[13px] tracking-wide text-ink";

function first(value: string | string[] | undefined): string {
  const v = Array.isArray(value) ? value[0] : value;
  return (v ?? "").trim();
}

function parsePage(value: string | string[] | undefined): number {
  const n = Number.parseInt(first(value), 10);
  return Number.isFinite(n) && n >= 1 && n <= 1000 ? n : 1;
}

export default function SellersPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16">
      <PageHeader
        eyebrow="Independent sellers"
        title="Sellers"
        lead="Approved gemstone sellers, ranked by rating and membership."
      />
      <Suspense fallback={null}>
        <SellersDirectory searchParams={searchParams} />
      </Suspense>
    </section>
  );
}

async function SellersDirectory({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const raw = await searchParams;
  const q = first(raw.q).slice(0, 120);
  const specialty = first(raw.specialty).slice(0, 60);
  const page = parsePage(raw.page);

  const [result, specialties] = await Promise.all([
    searchSellers({ q: q || undefined, specialty: specialty || undefined, page }),
    listSpecialties(),
  ]);
  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));
  const hrefFor = (p: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (specialty) params.set("specialty", specialty);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `/sellers?${qs}` : "/sellers";
  };

  return (
    <div className="grid gap-10 lg:grid-cols-[18rem_1fr]">
      <aside aria-label="Seller filters" className="lg:sticky lg:top-10 lg:self-start">
        <form method="get" action="/sellers" className="space-y-6 border border-line bg-surface-raised p-6">
          <div className="space-y-2">
            <label htmlFor="s-q" className={labelClass}>
              Search sellers
            </label>
            <Input id="s-q" name="q" type="search" defaultValue={q} maxLength={120} placeholder="Business name, city or state" />
          </div>
          <div className="space-y-2">
            <label htmlFor="s-specialty" className={labelClass}>
              Specialty
            </label>
            <Select id="s-specialty" name="specialty" defaultValue={specialty}>
              <option value="">All specialties</option>
              {specialties.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-3">
            <button type="submit" className={buttonClasses({ variant: "primary", size: "lg", block: true })}>
              Apply
            </button>
            <Link
              href="/sellers"
              className="inline-flex min-h-11 items-center justify-center text-[13px] tracking-wide text-ink-soft underline underline-offset-4 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              Clear filters
            </Link>
          </div>
        </form>
      </aside>

      <div className="min-w-0 space-y-10">
        <p className="border-b border-line pb-4 text-[13px] text-ink-soft">
          {result.total} {result.total === 1 ? "seller" : "sellers"}
        </p>
        {result.items.length === 0 ? (
          <EmptyState
            title="No sellers match these filters"
            body="Try a shorter search or clear the specialty."
            action={
              <Link href="/sellers" className={pageLink}>
                Clear filters
              </Link>
            }
          />
        ) : (
          <ul className="grid grid-cols-1 gap-x-8 gap-y-14 md:grid-cols-2 xl:grid-cols-3">
            {result.items.map((seller, i) => (
              <li key={seller.slug} className="space-y-3">
                <TierBadge tier={seller.tier} hasBadge={seller.hasBadge} />
                <SellerCard seller={seller} priority={i < 2} />
              </li>
            ))}
          </ul>
        )}
        <nav aria-label="Pagination" className="flex items-center justify-between gap-4 text-sm">
          {page > 1 ? (
            <Link href={hrefFor(page - 1)} rel="prev" className={pageLink}>
              Previous
            </Link>
          ) : (
            <span />
          )}
          <span className="text-[13px] text-ink-soft">
            Page {page} of {totalPages}
          </span>
          {page < totalPages ? (
            <Link href={hrefFor(page + 1)} rel="next" className={pageLink}>
              Next
            </Link>
          ) : (
            <span />
          )}
        </nav>
      </div>
    </div>
  );
}
