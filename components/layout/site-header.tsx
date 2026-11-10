import Link from "next/link";
import { Suspense } from "react";
import { ChevronDown } from "lucide-react";
import { SessionLinks } from "@/components/auth/session-links";
import { SignedOutLinks } from "@/components/auth/signed-out-links";
import { NotificationBell } from "@/components/notifications/notification-bell";

const nav = [
  { href: "/gemstones", label: "Gemstones" },
  { href: "/sellers", label: "Sellers" },
  { href: "/valuation", label: "Valuation" },
  { href: "/education", label: "Learn" },
  { href: "/news", label: "Market News" },
  { href: "/register/seller", label: "Become a Seller" },
];

/**
 * Site header: ivory bar, serif wordmark with a thin gold rule, quiet uppercase nav.
 * Phones get a native disclosure menu (works without JavaScript and keeps focus behaviour built in).
 */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/80">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-10">
        <Link href="/" className="group flex min-w-0 items-center gap-3" aria-label="Gemstone Selections, home">
          <span className="block h-8 w-px bg-accent transition duration-500 group-hover:h-9" aria-hidden />
          <span className="flex min-w-0 flex-col leading-none">
            <span className="truncate font-heading text-xl font-medium text-brand-strong sm:text-2xl">Gemstone Selections</span>
            <span className="mt-1 hidden text-[10px] uppercase tracking-[0.3em] text-ink-soft sm:block">Verified stones, India</span>
          </span>
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-7 lg:flex">
          {nav.map((item) => (
            <Link key={item.href} href={item.href} className="text-[12px] uppercase tracking-[0.18em] text-ink-soft transition duration-300 hover:text-ink">
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-4">
          {/* Signed-in only: renders nothing until the unread count loads. */}
          <NotificationBell />
          {/* Session state streams in; the signed-out links are the static fallback. */}
          <Suspense fallback={<SignedOutLinks />}>
            <SessionLinks />
          </Suspense>
          <details className="group relative lg:hidden">
            <summary className="flex cursor-pointer list-none items-center gap-1.5 px-2 py-2 text-[12px] uppercase tracking-[0.18em] text-ink hover:text-accent-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent [&::-webkit-details-marker]:hidden">
              Menu
              <ChevronDown className="h-3.5 w-3.5 transition duration-300 group-open:rotate-180" strokeWidth={1.25} aria-hidden />
            </summary>
            <nav aria-label="Primary mobile" className="absolute right-0 top-full z-50 mt-3 w-64 border border-line bg-surface-raised p-2 shadow-soft">
              <ul>
                {nav.map((item) => (
                  <li key={item.href}>
                    <Link href={item.href} className="block px-4 py-3 text-[14px] text-ink-soft hover:bg-accent-soft/50 hover:text-ink">
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </details>
        </div>
      </div>
    </header>
  );
}
