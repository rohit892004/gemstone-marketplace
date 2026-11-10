import Link from "next/link";

const LINKS = [
  { href: "/admin/newsletter", label: "Overview" },
  { href: "/admin/newsletter/subscribers", label: "Subscribers" },
  { href: "/admin/newsletter/campaigns", label: "Campaigns" },
  { href: "/admin/newsletter/campaigns/new", label: "New campaign" },
];

export function NewsletterNav() {
  return (
    <nav aria-label="Newsletter" className="flex flex-wrap gap-3 border-b border-stone-200 pb-3 text-sm">
      {LINKS.map((link) => (
        <Link key={link.href} href={link.href} className="rounded px-2 py-1 text-stone-700 hover:bg-stone-100 hover:text-stone-900">
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
