import Link from "next/link";

const nav = [
  { href: "/gemstones", label: "Gemstones" },
  { href: "/sellers", label: "Sellers" },
  { href: "/valuation", label: "Valuation" },
  { href: "/learn", label: "Learn" },
  { href: "/news", label: "Market News" },
];

export function SiteHeader() {
  return (
    <header className="border-b border-line bg-surface-raised">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <Link href="/" className="text-lg font-semibold tracking-tight text-brand-strong">
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
          <Link
            href="/login"
            className="rounded-md px-3 py-2 text-sm font-medium text-ink-soft hover:text-ink"
          >
            Log in
          </Link>
          <Link
            href="/register"
            className="rounded-md bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-brand-strong"
          >
            Join
          </Link>
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
