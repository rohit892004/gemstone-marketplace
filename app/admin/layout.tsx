import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { requirePageRole } from "@/lib/auth/require-role";

/** Admin pages are never indexed. */
export const metadata = { robots: { index: false, follow: false } };

const NAV = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/sellers", label: "Sellers" },
  { href: "/admin/listings", label: "Listing queue" },
  { href: "/admin/listings/all", label: "All listings" },
  { href: "/admin/documents", label: "Documents" },
  { href: "/admin/reviews", label: "Reviews" },
  { href: "/admin/moderation", label: "Flagged messages" },
  { href: "/admin/reports", label: "Reports" },
  { href: "/admin/requirements", label: "Requirements" },
  { href: "/admin/homepage", label: "Homepage" },
  { href: "/admin/settings", label: "Settings" },
];

const COMING_LATER = ["Buyers", "Content", "Valuations", "Audit log"];

/**
 * Admin shell. The session check lives in an async child inside <Suspense>
 * (Cache Components pattern), so the layout's static parts can still prerender.
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={null}>
      <AdminShell>{children}</AdminShell>
    </Suspense>
  );
}

async function AdminShell({ children }: { children: ReactNode }) {
  const admin = await requirePageRole(["ADMIN"]);

  return (
    // Stacked on phones (nav above content), side by side from md up.
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 md:flex-row">
      <aside className="w-full space-y-6 text-sm md:w-56 md:shrink-0">
        <div>
          <p className="font-semibold">Admin</p>
          <p className="truncate text-xs text-stone-600">{admin.email}</p>
        </div>
        <nav aria-label="Admin" className="flex flex-wrap gap-1 md:block md:space-y-1">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="block rounded px-2 py-1 hover:bg-stone-100">
              {item.label}
            </Link>
          ))}
          {COMING_LATER.map((label) => (
            <span key={label} aria-disabled="true" className="block px-2 py-1 text-stone-400">
              {label} <span className="text-xs">(coming later)</span>
            </span>
          ))}
        </nav>
      </aside>
      <main className="min-w-0 flex-1 w-full">{children}</main>
    </div>
  );
}
