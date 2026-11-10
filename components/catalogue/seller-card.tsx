import Link from "next/link";
import { DemoBadge } from "./badges";
import { Rating } from "./rating";
import { Photo } from "@/components/ui/photo";

export interface SellerCardData {
  slug: string;
  businessName: string;
  city: string;
  state: string;
  country: string;
  specialties: string[];
  ratingAverage: string | null;
  reviewCount: number;
  isDemo: boolean;
  /** False when the seller has no banner file: the card then shows the panel instead of requesting a 404. */
  hasBanner?: boolean;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

/**
 * Seller summary card in the luxury style: banner, overlapping monogram, name, place, specialties, rating.
 * Never shows contact details, GST, address or documents.
 */
export function SellerCard({ seller, priority = false }: { seller: SellerCardData; priority?: boolean }) {
  return (
    <article className="group flex h-full flex-col">
      <Link href={`/sellers/${seller.slug}`} className="block focus-visible:outline-none">
        <Photo
          src={seller.hasBanner === false ? "" : `/api/sellers/${seller.slug}/assets/banner`}
          alt={`${seller.businessName} banner`}
          ratio="aspect-[16/9]"
          priority={priority}
          sizes="(min-width: 640px) 340px, 78vw"
        />
      </Link>
      <div className="relative -mt-8 flex items-end gap-4 px-1">
        <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-full border-2 border-surface bg-panel">
          <span className="font-heading text-xl text-ivory" aria-hidden>
            {initials(seller.businessName)}
          </span>
        </div>
        <h3 className="pb-1 font-heading text-2xl leading-tight text-ink">
          <Link href={`/sellers/${seller.slug}`} className="hover:text-accent-text">
            {seller.businessName}
          </Link>
        </h3>
      </div>
      <p className="mt-3 text-[13px] text-ink-soft">
        {seller.city}, {seller.state}, {seller.country}
      </p>
      {seller.specialties.length > 0 ? (
        <p className="mt-1 text-[13px] text-ink-soft">{seller.specialties.slice(0, 3).join(" · ")}</p>
      ) : null}
      <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-3">
        <Rating average={seller.ratingAverage} count={seller.reviewCount} isDemo={false} />
        {seller.isDemo ? <DemoBadge /> : null}
      </div>
    </article>
  );
}
