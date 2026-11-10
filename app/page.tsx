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
import { ButtonLink } from "@/components/ui/button";
import { Photo } from "@/components/ui/photo";
import { LUXURY_PHOTOS } from "@/components/design-preview/luxury-images";

/**
 * Homepage, in the luxury design. Static shell with Suspense boundaries around every database read, so the
 * layout can be prerendered while the carousels and copy stream in.
 */

export const metadata = {
  title: "Buy and value certified gemstones",
  description:
    "Browse gemstones from verified sellers, compare listings by category, and request an indicative valuation.",
};

const Rule = () => <div className="h-px w-full bg-line" aria-hidden />;

export default function HomePage() {
  return (
    <div className="bg-surface text-ink">
      <section className="relative isolate overflow-hidden bg-night text-ivory">
        <div className="absolute inset-0">
          <Photo
            src={LUXURY_PHOTOS.hero}
            alt="Close-up of a gemstone against a dark background"
            ratio="h-full"
            className="h-full"
            zoomOnHover={false}
            priority
            sizes="100vw"
          />
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-night/60 via-night/40 to-night/85" aria-hidden />
        <div className="relative mx-auto flex min-h-[78vh] max-w-7xl flex-col justify-end px-6 pb-16 pt-36 sm:px-10">
          <p className="text-[11px] uppercase tracking-[0.3em] text-champagne">Gemstone marketplace</p>
          <Suspense
            fallback={
              <h1 id="hero-heading" className="mt-5 max-w-3xl font-heading text-5xl font-medium leading-[1.05] text-ivory sm:text-7xl">
                Discover, compare and value gemstones from verified sellers.
              </h1>
            }
          >
            <HeroCopy />
          </Suspense>
          <HeroSearch />
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-24 px-6 py-24 sm:px-10">
        <Suspense fallback={null}>
          <TopSellers />
        </Suspense>

        <Rule />

        <Suspense fallback={null}>
          <FeaturedListings />
        </Suspense>

        <Rule />

        <Suspense fallback={null}>
          <CategoryGrid />
        </Suspense>

        <Rule />

        <section aria-labelledby="explore-heading" className="space-y-6">
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

        <section
          aria-labelledby="become-seller-heading"
          className="grid gap-8 border border-line bg-surface-raised p-8 shadow-soft sm:p-10 md:grid-cols-[1fr_auto] md:items-center"
        >
          <div className="space-y-4">
            <p className="text-[11px] uppercase tracking-[0.28em] text-accent-text">For sellers</p>
            <h2 id="become-seller-heading" className="font-heading text-3xl text-ink sm:text-4xl">
              Become a seller
            </h2>
            <p className="max-w-2xl text-[15px] leading-relaxed text-ink-soft">
              Membership is free. Create a seller account, complete your business profile, and list your stones once our
              team has approved your application. Verified documents help buyers trust your listings.
            </p>
          </div>
          <ButtonLink href="/register/seller" variant="primary" size="lg">
            Register as a seller
          </ButtonLink>
        </section>
      </div>
    </div>
  );
}
