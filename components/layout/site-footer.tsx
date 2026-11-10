import Link from "next/link";
import { FooterSignup } from "@/components/newsletter/footer-signup";

const explore = [
  { href: "/gemstones", label: "Gemstones" },
  { href: "/sellers", label: "Sellers" },
  { href: "/valuation", label: "Valuation" },
  { href: "/education", label: "Education" },
  { href: "/reference", label: "Reference library" },
  { href: "/news", label: "Market news" },
];

const platform = [
  { href: "/register/seller", label: "Become a Seller" },
  { href: "/valuation", label: "Request a valuation" },
  { href: "/contact", label: "Help and contact" },
];

const legal = [
  { href: "/legal/terms", label: "Terms" },
  { href: "/legal/privacy", label: "Privacy" },
  { href: "/legal/cookies", label: "Cookies" },
  { href: "/legal/seller-agreement", label: "Seller agreement" },
];

const linkClass =
  "inline-flex min-h-11 items-center text-ivory/80 transition hover:text-champagne focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-champagne";
const labelClass = "text-[11px] font-normal uppercase tracking-[0.25em] text-champagne";

/**
 * Site footer, rendered on every page from the root layout. Four columns on desktop (brand, explore, platform,
 * newsletter), stacking on phones. The newsletter is a compact signup: Subscribe is consent to all topics.
 */
export function SiteFooter() {
  return (
    <footer className="mt-24 bg-night text-ivory">
      <div className="mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:grid-cols-2 sm:px-10 lg:grid-cols-4 lg:gap-10">
        <div className="space-y-4">
          <p className="font-heading text-2xl font-medium">Gemstone Selections</p>
          <p className="max-w-xs text-sm leading-relaxed text-ivory/70">
            A marketplace for certified and coloured gemstones, with education and market news for buyers and sellers.
          </p>
          <p className="max-w-xs text-sm leading-relaxed text-ivory/70">Indicative valuations — not certified appraisals.</p>
        </div>

        <nav aria-label="Explore" className="space-y-3">
          <h2 className={labelClass}>Explore</h2>
          <ul className="text-sm">
            {explore.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className={linkClass}>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Platform" className="space-y-3">
          <h2 className={labelClass}>Platform</h2>
          <ul className="text-sm">
            {platform.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className={linkClass}>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <section aria-labelledby="footer-newsletter-heading" className="space-y-3">
          <h2 id="footer-newsletter-heading" className={labelClass}>
            Newsletter
          </h2>
          <FooterSignup />
        </section>
      </div>

      <div className="border-t border-ivory/10">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-4 text-[12px] text-ivory/60 sm:flex-row sm:items-center sm:justify-between sm:px-10">
          <p className="py-2">© 2026 Gemstone Selections</p>
          <nav aria-label="Legal" className="flex flex-wrap gap-x-4">
            {legal.map((item) => (
              <Link key={item.href} href={item.href} className={`${linkClass} text-[12px]`}>
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  );
}
