import Link from "next/link";
import type { ReactNode } from "react";
import { connection } from "next/server";
import { Maximize2 } from "lucide-react";
import { Carousel, CarouselItem } from "@/components/catalogue/carousel";
import { ListingCard } from "@/components/catalogue/listing-card";
import { SellerCard } from "@/components/catalogue/seller-card";
import { TierBadge } from "@/components/membership/tier-badge";
import { ButtonLink, buttonClasses } from "@/components/ui/button";
import { Photo } from "@/components/ui/photo";
import { topRankedSellers } from "@/lib/seller-public/directory";
import { publicListingWhere } from "@/lib/listings/visibility";
import { loadCards } from "@/lib/listings/search";
import { prisma } from "@/lib/db/client";
import { loadHomepageBlocks } from "@/lib/homepage/blocks";
import { listPublicArticles } from "@/lib/content/service";
import { LUXURY_PHOTOS } from "@/components/design-preview/luxury-images";

/**
 * Async homepage sections, in the luxury design. Each one reads the database, so each is rendered inside a
 * <Suspense> boundary on the homepage. Layout-only pieces stay in the static shell.
 */

const eyebrow = "text-[11px] uppercase tracking-[0.28em] text-accent-text";
const sectionTitle = "mt-3 font-heading text-4xl font-medium leading-tight text-ink sm:text-5xl";
const categoryPhotos: Record<string, string> = LUXURY_PHOTOS.categories;
/** Neutral stone photo for any category slug without its own photo. The gem icon is never shown on the homepage. */
const categoryFallbackPhoto = LUXURY_PHOTOS.stones[0];
/** Focal point per category tile. The web files are already cropped on the stone, so this only matters if the tile ratio changes. */
const categoryFocus: Record<string, string> = {
  diamond: "object-[50%_50%]",
  emerald: "object-[50%_50%]",
  ruby: "object-[50%_50%]",
  sapphire: "object-[50%_50%]",
  amethyst: "object-[50%_50%]",
  opal: "object-[50%_50%]",
  spinel: "object-[50%_50%]",
  tourmaline: "object-[50%_50%]",
  "other-coloured-stones": "object-[50%_50%]",
};

/** Eyebrow, serif title and an optional action, as used on every homepage section. */
function SectionTop({ id, label, title, action }: { id?: string; label: string; title: string; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-6">
      <div>
        <p className={eyebrow}>{label}</p>
        <h2 id={id} className={sectionTitle}>
          {title}
        </h2>
      </div>
      {action}
    </div>
  );
}

export async function HeroCopy() {
  // Homepage copy comes from the admin-edited HomepageBlock table, so it must not be frozen at build time.
  await connection();
  const { hero } = await loadHomepageBlocks();
  return (
    <>
      <h1 className="mt-5 max-w-3xl font-heading text-5xl font-medium leading-[1.05] text-ivory sm:text-7xl">{hero.headline}</h1>
      <p className="mt-6 max-w-xl text-base leading-relaxed text-ivory/85">{hero.subheadline}</p>
      <HeroButtons />
    </>
  );
}

async function HeroButtons() {
  const { hero } = await loadHomepageBlocks();
  return (
    <div className="mt-8 flex flex-wrap gap-3">
      <ButtonLink href={hero.primaryCtaHref} variant="gold" size="lg">
        {hero.primaryCtaLabel}
      </ButtonLink>
      <Link
        href={hero.secondaryCtaHref}
        className="inline-flex min-h-11 items-center justify-center gap-2 border border-ivory/60 px-8 py-4 text-sm tracking-wide text-ivory transition duration-300 hover:bg-ivory/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        {hero.secondaryCtaLabel}
      </Link>
    </div>
  );
}

/** Static: a GET form to /gemstones. Works without JavaScript. */
export function HeroSearch() {
  return (
    <form action="/gemstones" method="get" role="search" className="mt-10 flex max-w-2xl flex-col gap-3 sm:flex-row">
      <label htmlFor="home-search" className="sr-only">
        Search gemstones
      </label>
      <input
        id="home-search"
        type="search"
        name="q"
        maxLength={120}
        placeholder="Search sapphire, ruby, emerald, origin..."
        className="min-h-11 min-w-0 flex-1 border border-ivory/40 bg-night/60 px-5 py-4 text-sm text-ivory placeholder:text-ivory/70 outline-none transition duration-300 focus:border-champagne focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      />
      <button type="submit" className={buttonClasses({ variant: "gold", size: "lg" })}>
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
    <section aria-labelledby="top-sellers-heading" className="space-y-12">
      <SectionTop id="top-sellers-heading" label="Independent sellers" title="Top-rated verified sellers" />
      <Carousel label="Top-rated verified sellers">
        {sellers.map((seller, i) => (
          <CarouselItem key={seller.slug}>
            <div className="flex h-full flex-col gap-3">
              <TierBadge tier={seller.tier} hasBadge={seller.hasBadge} />
              <SellerCard seller={seller} priority={i < 2} />
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
    <section aria-labelledby="featured-heading" className="space-y-12">
      <SectionTop
        id="featured-heading"
        label="Selected stones"
        title="Featured gemstones"
        action={
          <Link
            href="/gemstones"
            className="inline-flex min-h-11 items-center text-[13px] tracking-wide text-ink underline underline-offset-4 hover:text-accent-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Browse all
          </Link>
        }
      />
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
    <section aria-labelledby="categories-heading" className="space-y-12">
      <SectionTop id="categories-heading" label="Browse" title={blocks.categoriesHeading.heading} />
      {blocks.categoriesHeading.intro ? (
        <p className="-mt-6 max-w-2xl text-[15px] leading-relaxed text-ink-soft">{blocks.categoriesHeading.intro}</p>
      ) : null}
      {/* Flex-wrap with centred rows: any leftover tile in the last row is centred, so the grid is centred at every width. */}
      <ul className="flex flex-wrap justify-center gap-px">
        {categories.map((category) => (
          <li key={category.id} className="w-[calc((100%-1px)/2)] sm:w-[calc((100%-2px)/3)]">
            <Link
              href={`/categories/${category.slug}`}
              className="group relative block overflow-hidden focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
            >
              <Photo
                src={categoryPhotos[category.slug] ?? categoryFallbackPhoto}
                alt=""
                ratio="aspect-[4/5]"
                imgClassName={categoryFocus[category.slug] ?? "object-[50%_50%]"}
              />
              <span className="absolute inset-0 bg-gradient-to-t from-night/80 via-night/10 to-transparent" aria-hidden />
              <span className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-5 sm:p-6">
                <span className="font-heading text-2xl text-ivory sm:text-3xl">{category.name}</span>
                <Maximize2 className="h-4 w-4 shrink-0 text-ivory/70 transition duration-300 group-hover:text-champagne" strokeWidth={1.25} aria-hidden />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export async function Teasers() {
  // Request-time: the latest published education and news items change as content is published.
  await connection();
  const [blocks, latestEducation, latestNews] = await Promise.all([
    loadHomepageBlocks(),
    listPublicArticles({ types: ["EDUCATION", "GUIDE", "RESEARCH"], take: 1 }),
    listPublicArticles({ type: "NEWS", take: 1 }),
  ]);
  return (
    <div className="grid gap-6 md:grid-cols-3">
      <TeaserCard id="valuation-teaser" heading={blocks.valuationTeaser.heading} body={blocks.valuationTeaser.body} ctaLabel={blocks.valuationTeaser.ctaLabel} ctaHref={blocks.valuationTeaser.ctaHref} />
      <TeaserCard
        id="education-teaser"
        heading={blocks.educationTeaser.heading}
        body={blocks.educationTeaser.body}
        ctaLabel={blocks.educationTeaser.ctaLabel}
        ctaHref={blocks.educationTeaser.ctaHref}
        latest={latestEducation.items[0] ? { title: latestEducation.items[0].title, href: `/education/${latestEducation.items[0].slug}` } : null}
        emptyText="New guides are on the way."
      />
      <TeaserCard
        id="news-teaser"
        heading={blocks.newsTeaser.heading}
        body={blocks.newsTeaser.body}
        ctaLabel={blocks.newsTeaser.ctaLabel}
        ctaHref={blocks.newsTeaser.ctaHref}
        latest={latestNews.items[0] ? { title: latestNews.items[0].title, href: `/news/${latestNews.items[0].slug}` } : null}
        emptyText="No market news has been published yet."
      />
    </div>
  );
}

/** Newsletter teaser. Links to the live sign-up page; the form itself lives there. */
export async function NewsletterTeaser() {
  const blocks = await loadHomepageBlocks();
  const { heading, body } = blocks.newsletterTeaser;
  return (
    <section aria-labelledby="newsletter-heading" className="grid gap-6 border border-line bg-surface-raised p-8 shadow-soft md:grid-cols-[1fr_auto] md:items-center sm:p-10">
      <div className="space-y-3">
        <p className={eyebrow}>Newsletter</p>
        <h2 id="newsletter-heading" className="font-heading text-3xl text-ink">
          {heading}
        </h2>
        <p className="max-w-2xl text-[15px] leading-relaxed text-ink-soft">{body}</p>
      </div>
      <ButtonLink href="/newsletter" variant="primary" size="lg">
        Sign up for the newsletter
      </ButtonLink>
    </section>
  );
}

function TeaserCard({
  id,
  heading,
  body,
  ctaLabel,
  ctaHref,
  latest,
  emptyText,
}: {
  id: string;
  heading: string;
  body: string;
  ctaLabel: string;
  ctaHref: string;
  latest?: { title: string; href: string } | null;
  emptyText?: string;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className="flex flex-col gap-4 border border-line bg-surface-raised p-7 shadow-soft">
      <h2 id={`${id}-heading`} className="font-heading text-2xl text-ink">
        {heading}
      </h2>
      <p className="text-[15px] leading-relaxed text-ink-soft">{body}</p>
      {latest === undefined ? null : latest ? (
        <p className="text-[14px] text-ink">
          Latest:{" "}
          <Link href={latest.href} className="underline underline-offset-4 hover:text-accent-text">
            {latest.title}
          </Link>
        </p>
      ) : emptyText ? (
        <p className="text-[14px] italic text-ink-soft">{emptyText}</p>
      ) : null}
      <Link
        href={ctaHref}
        className="mt-auto inline-flex min-h-11 items-center text-[13px] tracking-wide text-ink underline underline-offset-4 hover:text-accent-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        {ctaLabel}
      </Link>
    </section>
  );
}
