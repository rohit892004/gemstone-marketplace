import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { SellerCard } from "@/components/catalogue/seller-card";
import { type RawSearchParams } from "@/components/catalogue/query-params";
import { listSpecialties, searchSellers } from "@/lib/seller-public/directory";

export const metadata: Metadata = {
  title: "Sellers",
  description: "Approved gemstone sellers. Search by business name, city or state, and filter by specialty.",
};

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
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">Sellers</h1>
        <p className="mt-2 text-ink-soft">Approved gemstone sellers, ranked by rating.</p>
      </header>
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
    <div className="grid gap-8 lg:grid-cols-[18rem_1fr]">
      <aside aria-label="Seller filters">
        <form method="get" action="/sellers" className="space-y-5 rounded-lg border border-line bg-surface-raised p-5">
          <div>
            <label htmlFor="s-q" className="block text-sm font-medium text-ink">
              Search sellers
            </label>
            <input
              id="s-q"
              name="q"
              type="search"
              defaultValue={q}
              maxLength={120}
              placeholder="Business name, city or state"
              className="mt-1 w-full rounded-md border border-line bg-surface-raised px-3 py-2 text-sm text-ink"
            />
          </div>
          <div>
            <label htmlFor="s-specialty" className="block text-sm font-medium text-ink">
              Specialty
            </label>
            <select
              id="s-specialty"
              name="specialty"
              defaultValue={specialty}
              className="mt-1 w-full rounded-md border border-line bg-surface-raised px-3 py-2 text-sm text-ink"
            >
              <option value="">All specialties</option>
              {specialties.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-strong"
            >
              Apply
            </button>
            <Link href="/sellers" className="text-sm text-ink-soft underline underline-offset-4 hover:text-ink">
              Clear filters
            </Link>
          </div>
        </form>
      </aside>

      <div className="space-y-6">
        <p className="text-sm text-ink-soft">
          {result.total} {result.total === 1 ? "seller" : "sellers"}
        </p>
        {result.items.length === 0 ? (
          <div className="rounded-lg border border-dashed border-line bg-surface-raised p-8 text-center">
            <h2 className="text-lg font-semibold text-ink">No sellers match these filters</h2>
            <Link href="/sellers" className="mt-4 inline-block text-sm font-medium text-brand-strong underline underline-offset-4">
              Clear filters
            </Link>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {result.items.map((seller) => (
              <li key={seller.slug}>
                <SellerCard seller={seller} />
              </li>
            ))}
          </ul>
        )}
        <nav aria-label="Pagination" className="flex items-center justify-between gap-4 text-sm">
          {page > 1 ? (
            <Link href={hrefFor(page - 1)} rel="prev" className="rounded-md border border-line px-3 py-1.5 hover:border-ink-soft">
              Previous
            </Link>
          ) : (
            <span />
          )}
          <span className="text-ink-soft">
            Page {page} of {totalPages}
          </span>
          {page < totalPages ? (
            <Link href={hrefFor(page + 1)} rel="next" className="rounded-md border border-line px-3 py-1.5 hover:border-ink-soft">
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
