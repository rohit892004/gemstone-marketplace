import Link from "next/link";
import { Suspense } from "react";
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

export function SiteHeader() {
  return (
    <header className="border-b border-line bg-surface-raised">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-4 gap-y-3 px-4 py-4 sm:px-6">
        <Link href="/" className="whitespace-nowrap text-base font-semibold tracking-tight text-brand-strong sm:text-lg">
          Gemstone Selections
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-6 md:flex">
          {nav.map((item) => (
            <Link key={item.href} href={item.href} className="text-sm text-ink-soft hover:text-ink">
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {/* Signed-in only: renders nothing until the unread count loads. */}
          <NotificationBell />
          {/* Session state streams in; the signed-out links are the static fallback. */}
          <Suspense fallback={<SignedOutLinks />}>
            <SessionLinks />
          </Suspense>
        </div>
      </div>

      {/* Mobile nav: simple wrapping list; replaced by a disclosure menu in a later milestone. */}
      <nav aria-label="Primary mobile" className="flex flex-wrap gap-x-4 gap-y-2 border-t border-line px-4 py-2 md:hidden">
        {nav.map((item) => (
          <Link key={item.href} href={item.href} className="text-sm text-ink-soft hover:text-ink">
            {item.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
