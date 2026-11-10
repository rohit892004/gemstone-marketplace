import Link from "next/link";
import type { ReactNode } from "react";

/** Sub-navigation for the valuation admin pages. The admin shell (app/admin/layout.tsx) checks the session. */
const SECTIONS = [
  { href: "/admin/valuations", label: "Queue" },
  { href: "/admin/valuations/valuators", label: "Valuers" },
  { href: "/admin/valuations/prices", label: "Reference prices" },
  { href: "/admin/valuations/settings", label: "Expert threshold" },
  { href: "/admin/valuations/stats", label: "Stats" },
];

export default function AdminValuationsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-6">
      <nav aria-label="Valuation sections" className="flex flex-wrap gap-2 text-sm">
        {SECTIONS.map((section) => (
          <Link key={section.href} href={section.href} className="rounded border border-stone-300 bg-white px-3 py-1 hover:bg-stone-100">
            {section.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
