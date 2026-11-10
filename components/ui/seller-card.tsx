import Link from "next/link";
import { Star } from "lucide-react";
import { cx } from "./cx";
import { DemoTag } from "./badge";
import { Photo } from "./photo";

export interface SellerCardProps {
  href: string;
  name: string;
  place: string;
  specialties: string;
  rating?: number;
  reviewCount?: number;
  /** Banner photo, 16:9. Omit to show a plain panel. */
  banner?: { src: string; alt: string };
  /** Logo image (monogram). Omit to show initials. */
  logo?: { src: string; alt: string };
  demo?: boolean;
  className?: string;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

/** Seller tile: banner, overlapping logo, name, place, specialties and rating. Used in carousels and the directory. */
export function SellerCard({ href, name, place, specialties, rating, reviewCount, banner, logo, demo, className }: SellerCardProps) {
  return (
    <article className={cx("group", className)}>
      <Link href={href} className="block focus-visible:outline-none">
        <Photo src={banner?.src ?? ""} alt={banner?.alt ?? ""} ratio="aspect-[16/9]" zoomOnHover />
      </Link>
      <div className="relative -mt-8 flex items-end gap-4 px-1">
        <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-full border-2 border-surface bg-panel">
          {logo ? (
            <Photo src={logo.src} alt={logo.alt} ratio="aspect-square" className="h-full w-full" zoomOnHover={false} sizes="64px" />
          ) : (
            <span className="font-heading text-xl text-ivory" aria-hidden>
              {initials(name)}
            </span>
          )}
        </div>
        <h3 className="pb-1 font-heading text-2xl leading-tight text-ink">
          <Link href={href} className="hover:text-accent-text">
            {name}
          </Link>
        </h3>
      </div>
      <p className="mt-3 text-[13px] text-ink-soft">{place}</p>
      <div className="mt-1 flex items-center justify-between gap-3 text-[13px] text-ink-soft">
        <span>{specialties}</span>
        {typeof rating === "number" ? (
          <span className="flex items-center gap-1 tabular-nums">
            <Star className="h-3.5 w-3.5" strokeWidth={1.25} aria-hidden />
            {rating.toFixed(1)}
            {typeof reviewCount === "number" ? <span className="text-ink-soft/80">({reviewCount})</span> : null}
          </span>
        ) : null}
      </div>
      {demo ? (
        <div className="mt-2">
          <DemoTag />
        </div>
      ) : null}
    </article>
  );
}
