import Link from "next/link";
import { connection } from "next/server";
import { Carousel, CarouselItem } from "@/components/catalogue/carousel";
import { ListingCard } from "@/components/catalogue/listing-card";
import { SellerCard } from "@/components/catalogue/seller-card";
import { TierBadge } from "@/components/membership/tier-badge";
import { topRankedSellers } from "@/lib/seller-public/directory";
import { publicListingWhere } from "@/lib/listings/visibility";
import { loadCards } from "@/lib/listings/search";
import { prisma } from "@/lib/db/client";
import { loadHomepageBlocks } from "@/lib/homepage/blocks";

/**
 * Async homepage sections. Each one reads the database, so each is rendered inside a <Suspense>
 * boundary on the homepage. Layout-only pieces stay in the static shell.
 */

export async function HeroCopy() {
  // Homepage copy comes from the admin-edited HomepageBlock table, so it must not be frozen at build time.
  await connection();
  const { hero } = await loadHomepageBlocks();
  return (
    <>
      <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight text-ink sm:text-5xl">{hero.headline}</h1>
      <p className="mt-6 max-w-2xl text-lg text-ink-soft">{hero.subheadline}</p>
      <HeroButtons />
    </>
  );
}

async function HeroButtons() {
  const { hero } = await loadHomepageBlocks();
  return (
    <div className="mt-8 flex flex-wrap gap-3">
      <Link href={hero.primaryCtaHref} className="rounded-md bg-brand px-5 py-3 text-sm font-medium text-white hover:bg-brand-strong">
        {hero.primaryCtaLabel}
      </Link>
      <Link href={hero.secondaryCtaHref} className="rounded-md border border-line bg-surface-raised px-5 py-3 text-sm font-medium text-ink hover:border-ink-soft">
        {hero.secondaryCtaLabel}
      </Link>
    </div>
  );
}

/** Static: a GET form to /gemstones. Works without JavaScript. */
export function HeroSearch() {
  return (
    <form action="/gemstones" method="get" role="search" className="mt-10 flex max-w-2xl flex-col gap-2 sm:flex-row">
      <label htmlFor="home-search" className="sr-only">
        Search gemstones
      </label>
      <input
        id="home-search"
        type="search"
        name="q"
        maxLength={120}
        placeholder="Search sapphire, ruby, emerald, origin..."
        className="min-w-0 flex-1 rounded-md border border-line bg-surface-raised px-4 py-3 text-sm text-ink placeholder:text-ink-soft"
      />
      <button type="submit" className="rounded-md bg-ink px-5 py-3 text-sm font-medium text-surface-raised hover:bg-ink-soft">
        Search
      </button>
    </form>
  );
}

export async function TopSellers() {
  // Request-time: listings and ratings change as sellers publish and buyers review.
  // Without this, Cache Components prerenders the section at build time and it goes stale.
  await connection();
  // Approved sellers with at least one public listing, best rated first, with the membership boost added.
  const sellers = await topRankedSellers(12);
  if (sellers.length === 0) return null;

  return (
    <section aria-labelledby="top-sellers-heading" className="space-y-4">
      <h2 id="top-sellers-heading" className="text-2xl font-semibold text-ink">
        Top-rated verified sellers
      </h2>
      <Carousel label="Top-rated verified sellers">
        {sellers.map((seller) => (
          <CarouselItem key={seller.slug}>
            <div className="flex h-full flex-col gap-2">
              <TierBadge tier={seller.tier} hasBadge={seller.hasBadge} />
              <SellerCard seller={seller} />
            </div>
          </CarouselItem>
        ))}
      </Carousel>
    </section>
  );
}

export async function FeaturedListings() {
  // Request-time, for the same reason as TopSellers: publishing and featuring must show immediately.
  await connection();
  const rows = await prisma.gemstone.findMany({
    where: { AND: [publicListingWhere(), { featured: true }] },
    orderBy: [{ publishedAt: "desc" }, { id: "asc" }],
    take: 12,
    select: { id: true },
  });
  const cards = await loadCards(rows.map((r) => r.id));
  if (cards.length === 0) return null;

  return (
    <section aria-labelledby="featured-heading" className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <h2 id="featured-heading" className="text-2xl font-semibold text-ink">
          Featured gemstones
        </h2>
        <Link href="/gemstones" className="text-sm text-ink-soft underline hover:text-ink">
          Browse all
        </Link>
      </div>
      <Carousel label="Featured gemstones">
        {cards.map((card, index) => (
          <CarouselItem key={card.id}>
            <ListingCard listing={card} priority={index < 2} />
          </CarouselItem>
        ))}
      </Carousel>
    </section>
  );
}

export async function CategoryGrid() {
  await connection();
  const [categories, blocks] = await Promise.all([
    prisma.category.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, slug: true } }),
    loadHomepageBlocks(),
  ]);
  if (categories.length === 0) return null;

  return (
    <section aria-labelledby="categories-heading" className="space-y-4">
      <div>
        <h2 id="categories-heading" className="text-2xl font-semibold text-ink">
          {blocks.categoriesHeading.heading}
        </h2>
        {blocks.categoriesHeading.intro ? <p className="mt-1 text-sm text-ink-soft">{blocks.categoriesHeading.intro}</p> : null}
      </div>
      <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {categories.map((category) => (
          <li key={category.id}>
            <Link
              href={`/categories/${category.slug}`}
              className="block rounded-lg border border-line bg-surface-raised p-4 font-medium text-ink hover:border-ink-soft"
            >
              {category.name}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export async function Teasers() {
  const blocks = await loadHomepageBlocks();
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <TeaserCard id="valuation-teaser" heading={blocks.valuationTeaser.heading} body={blocks.valuationTeaser.body} ctaLabel={blocks.valuationTeaser.ctaLabel} ctaHref={blocks.valuationTeaser.ctaHref} />
      <TeaserCard id="education-teaser" heading={blocks.educationTeaser.heading} body={blocks.educationTeaser.body} ctaLabel={blocks.educationTeaser.ctaLabel} ctaHref={blocks.educationTeaser.ctaHref} />
      <TeaserCard id="news-teaser" heading={blocks.newsTeaser.heading} body={blocks.newsTeaser.body} ctaLabel={blocks.newsTeaser.ctaLabel} ctaHref={blocks.newsTeaser.ctaHref} />
    </div>
  );
}

export async function NewsletterTeaser() {
  const blocks = await loadHomepageBlocks();
  const { heading, body } = blocks.newsletterTeaser;
  return (
    <section aria-labelledby="newsletter-heading" className="rounded-lg border border-line bg-surface-raised p-6">
      <h2 id="newsletter-heading" className="text-xl font-semibold text-ink">
        {heading}
      </h2>
      <p className="mt-2 text-sm text-ink-soft">{body}</p>
      <form className="mt-4 flex flex-col gap-2 sm:flex-row" aria-describedby="newsletter-note">
        <label htmlFor="newsletter-email" className="sr-only">
          Email address
        </label>
        <input
          id="newsletter-email"
          type="email"
          disabled
          placeholder="you@example.com"
          className="min-w-0 flex-1 rounded-md border border-line bg-surface px-4 py-3 text-sm"
        />
        <button type="button" disabled className="rounded-md bg-ink px-5 py-3 text-sm font-medium text-surface-raised opacity-50">
          Coming soon
        </button>
      </form>
      <p id="newsletter-note" className="mt-2 text-xs text-ink-soft">
        Newsletter sign-up is not open yet. We do not store email addresses at this time.
      </p>
    </section>
  );
}

function TeaserCard({ id, heading, body, ctaLabel, ctaHref }: { id: string; heading: string; body: string; ctaLabel: string; ctaHref: string }) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className="flex flex-col gap-3 rounded-lg border border-line bg-surface-raised p-6">
      <h2 id={`${id}-heading`} className="text-lg font-semibold text-ink">
        {heading}
      </h2>
      <p className="text-sm text-ink-soft">{body}</p>
      <Link href={ctaHref} className="mt-auto text-sm font-medium text-brand-strong underline">
        {ctaLabel}
      </Link>
    </section>
  );
}
