import Image from "next/image";
import Link from "next/link";
import type { ListingCard as ListingCardData } from "@/lib/listings/search";
import { DemoBadge, VerifiedBadge } from "./badges";

/**
 * Compact listing card used in grids and carousels. Images are lazy-loaded. Shows Verified
 * only when the listing has a verified public document, and Demo for seeded content.
 */
export function ListingCard({ listing, priority = false }: { listing: ListingCardData; priority?: boolean }) {
  const specs = [listing.species, listing.shape, listing.caratWeight ? `${listing.caratWeight} ct` : null]
    .filter(Boolean)
    .join(" · ");
  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-lg border border-line bg-surface-raised transition hover:border-ink-soft/50">
      <Link href={`/gemstones/${listing.slug}`} className="block focus-visible:outline-none">
        <div className="relative aspect-[4/3] bg-accent-soft">
          {listing.coverUrl ? (
            <Image
              src={listing.coverUrl}
              alt={listing.title}
              fill
              sizes="(min-width: 1024px) 25vw, (min-width: 640px) 40vw, 80vw"
              className="object-cover"
              loading={priority ? "eager" : "lazy"}
              unoptimized
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-ink-soft" aria-label="No image yet">
              No image yet
            </div>
          )}
        </div>
        <div className="space-y-2 p-4">
          <div className="flex flex-wrap items-center gap-2">
            {listing.hasVerifiedDocument ? <VerifiedBadge /> : null}
            {listing.isDemo ? <DemoBadge /> : null}
            {listing.availability === "RESERVED" ? (
              <span className="text-xs font-medium text-accent">Reserved</span>
            ) : null}
            {listing.availability === "SOLD" ? <span className="text-xs font-medium text-ink-soft">Sold</span> : null}
          </div>
          <h3 className="line-clamp-2 font-medium text-ink group-hover:text-brand-strong">{listing.title}</h3>
          {specs ? <p className="text-sm text-ink-soft">{specs}</p> : null}
          <p className="text-sm font-semibold text-ink">
            {listing.priceOnRequest ? "Price on request" : listing.priceLabel}
          </p>
        </div>
      </Link>
      <p className="mt-auto border-t border-line px-4 py-2 text-xs text-ink-soft">
        {listing.seller.businessName} · {listing.seller.city}, {listing.seller.state}
      </p>
    </article>
  );
}
