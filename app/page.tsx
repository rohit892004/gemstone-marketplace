import Link from "next/link";
import { Suspense } from "react";
import {
  CategoryGrid,
  FeaturedListings,
  HeroCopy,
  HeroSearch,
  NewsletterTeaser,
  Teasers,
  TopSellers,
} from "@/components/home/home-sections";

/**
 * Homepage. Static shell with Suspense boundaries around every database read, so the layout can be
 * prerendered while the carousels and copy stream in.
 */

export const metadata = {
  title: "Buy and value certified gemstones",
  description:
    "Browse gemstones from verified sellers, compare listings by category, and request an indicative valuation.",
};

export default function HomePage() {
  return (
    <div className="mx-auto max-w-7xl space-y-20 px-4 py-16 sm:px-6 sm:py-20">
      <section>
        <p className="text-sm font-medium uppercase tracking-widest text-accent-text">Gemstone marketplace</p>
        <Suspense
          fallback={
            <h1 id="hero-heading" className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
              Discover, compare and value gemstones from verified sellers.
            </h1>
          }
        >
          <HeroCopy />
        </Suspense>
        <HeroSearch />
      </section>

      <Suspense fallback={null}>
        <TopSellers />
      </Suspense>

      <Suspense fallback={null}>
        <FeaturedListings />
      </Suspense>

      <Suspense fallback={null}>
        <CategoryGrid />
      </Suspense>

      <section aria-labelledby="explore-heading" className="space-y-4">
        <h2 id="explore-heading" className="sr-only">
          Explore
        </h2>
        <Suspense fallback={null}>
          <Teasers />
        </Suspense>
      </section>

      <Suspense fallback={null}>
        <NewsletterTeaser />
      </Suspense>

      <section aria-labelledby="become-seller-heading" className="grid gap-6 rounded-lg border border-line bg-surface-raised p-8 md:grid-cols-[1fr_auto] md:items-center">
        <div className="space-y-3">
          <h2 id="become-seller-heading" className="text-2xl font-semibold text-ink">
            Become a seller
          </h2>
          <p className="max-w-2xl text-sm text-ink-soft">
            Membership is free. Create a seller account, complete your business profile, and list your stones once our
            team has approved your application. Verified documents help buyers trust your listings.
          </p>
        </div>
        <Link
          href="/register/seller"
          className="rounded-md bg-brand px-5 py-3 text-center text-sm font-medium text-white hover:bg-brand-strong"
        >
          Register as a seller
        </Link>
      </section>
    </div>
  );
}
