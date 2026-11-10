import Link from "next/link";
import type { ReactNode } from "react";
import { ShieldCheck } from "lucide-react";
import { cx } from "./cx";
import { Photo } from "./photo";
import { DemoTag } from "./badge";

export interface ProductCardProps {
  href: string;
  name: string;
  /** One short line: carat, shape, origin. */
  spec: string;
  /** Already formatted price, or "On request". */
  price: string;
  photo: { src: string; alt: string };
  verified?: boolean;
  demo?: boolean;
  /** Extra control shown top-right of the photo, e.g. a wishlist button. Rendered outside the link. */
  corner?: ReactNode;
  priority?: boolean;
  className?: string;
}

/**
 * Gemstone listing card. Photo first, then name, spec, price. The whole card is one link; `corner` sits above it
 * so a button inside it does not nest a link in a link.
 */
export function ProductCard({ href, name, spec, price, photo, verified, demo, corner, priority, className }: ProductCardProps) {
  return (
    <article className={cx("group relative", className)}>
      <Link href={href} className="block focus-visible:outline-none">
        <Photo src={photo.src} alt={photo.alt} ratio="aspect-square" priority={priority} />
        <span className="absolute inset-0 ring-accent group-focus-visible:ring-2 ring-offset-2 ring-offset-surface" aria-hidden />
      </Link>
      {corner ? <div className="absolute right-3 top-3 z-10">{corner}</div> : null}
      <div className="pt-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-heading text-xl leading-snug text-ink">
            <Link href={href} className="hover:text-accent-text">
              {name}
            </Link>
          </h3>
          {verified ? (
            <span className="flex shrink-0 items-center gap-1 pt-1.5 text-[11px] uppercase tracking-wider text-accent-text">
              <ShieldCheck className="h-3.5 w-3.5" strokeWidth={1.25} aria-hidden /> Verified
            </span>
          ) : null}
        </div>
        <p className="mt-1.5 text-[13px] text-ink-soft">{spec}</p>
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-[15px] text-ink">{price}</p>
          {demo ? <DemoTag /> : null}
        </div>
      </div>
    </article>
  );
}
