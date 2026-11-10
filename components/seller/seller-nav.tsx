import Link from "next/link";

export const sellerNavItems = [
  { href: "/seller", label: "Overview" },
  { href: "/seller/portfolio", label: "Portfolio" },
  { href: "/seller/listings", label: "Listings" },
  { href: "/seller/inventory", label: "Inventory" },
  { href: "/seller/inbox", label: "Inbox" },
  { href: "/seller/requirements", label: "Requirements" },
  { href: "/seller/quotations", label: "Quotations" },
  { href: "/seller/offers", label: "Offers" },
  { href: "/seller/valuations", label: "Valuations" },
  { href: "/seller/analytics", label: "Analytics" },
  { href: "/seller/membership", label: "Membership" },
] as const;

export function SellerNav() {
  return (
    <nav aria-label="Seller" className="border-b border-line bg-surface-raised">
      <ul className="mx-auto flex max-w-7xl gap-6 overflow-x-auto px-4 sm:px-6">
        {sellerNavItems.map((item) => (
          <li key={item.href}>
            <Link href={item.href} className="block whitespace-nowrap py-3 text-sm text-ink-soft hover:text-ink">
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
