import type { ReactNode } from "react";
import { Photo } from "@/components/ui/photo";

/**
 * Split layout for the account pages. Left: eyebrow, serif title, short lead and the form or message.
 * Right (lg and up only, so the form stays above the fold on phones): a photograph with a quiet caption
 * on a dark gradient. The photo is decorative, so it carries no alt text; the caption says the useful thing.
 */
export function AuthLayout({
  eyebrow,
  title,
  lead,
  photo,
  caption,
  children,
}: {
  eyebrow: string;
  title: string;
  lead?: ReactNode;
  photo: string;
  caption: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto grid w-full max-w-6xl items-center gap-12 px-4 py-10 sm:px-6 sm:py-16 lg:grid-cols-2 lg:gap-16 lg:py-24">
      <div className="mx-auto w-full max-w-md lg:mx-0">
        <p className="text-[11px] uppercase tracking-[0.28em] text-accent-text">{eyebrow}</p>
        <h1 className="mt-4 font-heading text-4xl font-medium leading-[1.1] text-ink sm:text-5xl">{title}</h1>
        {lead ? <div className="mt-4 text-base leading-relaxed text-ink-soft">{lead}</div> : null}
        <div className="mt-8 space-y-6">{children}</div>
      </div>

      <div className="relative hidden lg:block">
        <Photo src={photo} alt="" ratio="aspect-[4/5]" className="w-full" zoomOnHover={false} />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-night/85 via-night/40 to-transparent p-8 pt-24">
          <span className="block h-px w-12 bg-champagne" aria-hidden />
          <p className="mt-5 max-w-xs font-heading text-2xl leading-snug text-ivory">{caption}</p>
        </div>
      </div>
    </div>
  );
}

/** Standalone text link on its own line. Meets the 44px touch target on phones. */
export const authLinkClass =
  "inline-flex min-h-11 items-center justify-center font-medium text-brand underline-offset-4 hover:text-brand-strong hover:underline " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
