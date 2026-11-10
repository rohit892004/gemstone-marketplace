import Link from "next/link";
import type { ListingCard as ListingCardData } from "@/lib/listings/search";
import { Photo } from "@/components/ui/photo";
import { DemoBadge, VerifiedBadge } from "./badges";

/**
 * Gemstone listing card in the luxury style: square photo, serif name, spec line, price, then the seller line.
 * Shows Verified only when the listing has a verified public document, and Demo for seeded content.
 */
export function ListingCard({ listing, priority = false }: { listing: ListingCardData; priority?: boolean }) {
  const specs = [listing.species, listing.shape, listing.caratWeight ? `${listing.caratWeight} ct` : null]
    .filter(Boolean)
    .join(" · ");
  return (
    <article data-impression-id={listing.id} className="group flex h-full flex-col">
      <Link href={`/gemstones/${listing.slug}`} className="block focus-visible:outline-none" aria-label={listing.coverUrl ? undefined : listing.title}>
        <Photo
          src={listing.coverUrl ?? ""}
          alt={listing.coverUrl ? listing.title : ""}
          ratio="aspect-square"
          priority={priority}
          sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 80vw"
        />
      </Link>
      <div className="flex flex-1 flex-col pt-5">
        <div className="flex flex-wrap items-center gap-2">
          {listing.hasVerifiedDocument ? <VerifiedBadge /> : null}
          {listing.availability === "RESERVED" ? (
            <span className="text-[11px] uppercase tracking-[0.14em] text-accent-text">Reserved</span>
          ) : null}
          {listing.availability === "SOLD" ? <span className="text-[11px] uppercase tracking-[0.14em] text-ink-soft">Sold</span> : null}
        </div>
        <h3 className="mt-3 line-clamp-2 font-heading text-xl leading-snug text-ink">
          <Link href={`/gemstones/${listing.slug}`} className="hover:text-accent-text">
            {listing.title}
          </Link>
        </h3>
        {specs ? <p className="mt-1.5 text-[13px] text-ink-soft">{specs}</p> : null}
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-[15px] text-ink">{listing.priceOnRequest ? "Price on request" : listing.priceLabel}</p>
          {listing.isDemo ? <DemoBadge /> : null}
        </div>
        <p className="mt-auto pt-4 text-[12px] text-ink-soft">
          {listing.seller.businessName} · {listing.seller.city}, {listing.seller.state}
        </p>
      </div>
    </article>
  );
}
