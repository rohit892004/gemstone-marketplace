import Link from "next/link";
import { NewsletterSignup } from "@/components/newsletter/newsletter-signup";

const legal = [
  { href: "/legal/terms", label: "Terms of use" },
  { href: "/legal/privacy", label: "Privacy notice" },
  { href: "/legal/cookies", label: "Cookies" },
  { href: "/legal/seller-agreement", label: "Seller agreement" },
];

/**
 * Site footer: a dark band with a short brand note, two link columns and a compact newsletter line.
 * Kept small on purpose; the newsletter takes one row, not a page-sized block.
 */
export function SiteFooter() {
  return (
    <footer className="mt-24 bg-night text-ivory">
      <div className="mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:grid-cols-2 sm:px-10 lg:grid-cols-[1.4fr_1fr_1fr]">
        <div className="space-y-4">
          <p className="font-heading text-2xl font-medium">Gemstone Selections</p>
          <p className="max-w-sm text-sm leading-relaxed text-ivory/70">
            Indicative valuations and marketplace listings. Not a certified appraisal.
          </p>
        </div>

        <nav aria-label="Footer" className="space-y-3 text-sm">
          <p className="text-[11px] uppercase tracking-[0.25em] text-champagne">Platform</p>
          <ul className="space-y-3">
            <li>
              <Link href="/register/seller" className="text-ivory/80 transition hover:text-champagne">
                Become a Seller
              </Link>
            </li>
            <li>
              <Link href="/valuation" className="text-ivory/80 transition hover:text-champagne">
                Request a valuation
              </Link>
            </li>
            {legal.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="text-ivory/80 transition hover:text-champagne">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="space-y-4">
          <p className="text-[11px] uppercase tracking-[0.25em] text-champagne">Letters from the market</p>
          <p className="text-sm leading-relaxed text-ivory/70">Occasional notes on stones, sellers and new listings.</p>
          {/* The signup uses light-surface text colours, so it sits on an ivory panel inside the dark footer. */}
          <div className="bg-surface p-5 text-ink">
            <NewsletterSignup source="footer" variant="inline" />
          </div>
        </div>
      </div>
      <div className="border-t border-ivory/10">
        <p className="mx-auto max-w-7xl px-4 py-6 text-[12px] text-ivory/50 sm:px-10">© Gemstone Selections. All rights reserved.</p>
      </div>
    </footer>
  );
}
