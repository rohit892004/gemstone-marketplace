import Link from "next/link";
import { DemoBadge } from "./badges";
import { Rating } from "./rating";

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
}

/** Seller summary card. Never shows contact details, GST, address or documents. */
export function SellerCard({ seller }: { seller: SellerCardData }) {
  return (
    <article className="flex h-full flex-col gap-3 rounded-lg border border-line bg-surface-raised p-5">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-semibold text-ink">
          <Link href={`/sellers/${seller.slug}`} className="hover:text-brand-strong">
            {seller.businessName}
          </Link>
        </h3>
        {seller.isDemo ? <DemoBadge /> : null}
      </div>
      <p className="text-sm text-ink-soft">
        {seller.city}, {seller.state}, {seller.country}
      </p>
      {seller.specialties.length > 0 ? (
        <p className="text-sm text-ink-soft">{seller.specialties.slice(0, 3).join(" · ")}</p>
      ) : null}
      <div className="mt-auto">
        <Rating average={seller.ratingAverage} count={seller.reviewCount} isDemo={seller.isDemo} />
      </div>
    </article>
  );
}
