import { Suspense, type ReactNode } from "react";
import {
  BadgeCheck,
  ChartColumn,
  ClipboardList,
  CreditCard,
  FileText,
  Flag,
  Gem,
  Gift,
  House,
  LayoutDashboard,
  ListChecks,
  Mail,
  MessageSquare,
  Calculator,
  Settings,
  Star,
  Users,
} from "lucide-react";
import { AdminNav, type AdminNavItem } from "@/components/admin/admin-nav";
import { requirePageRole } from "@/lib/auth/require-role";

/** Admin pages are never indexed. */
export const metadata = { robots: { index: false, follow: false } };

const NAV: AdminNavItem[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, group: "Overview" },
  { href: "/admin/sellers", label: "Sellers", icon: Users, group: "Marketplace" },
  { href: "/admin/listings", label: "Listing queue", icon: ClipboardList, group: "Marketplace" },
  { href: "/admin/listings/all", label: "All listings", icon: Gem, group: "Marketplace" },
  { href: "/admin/documents", label: "Documents", icon: FileText, group: "Marketplace" },
  { href: "/admin/reviews", label: "Reviews", icon: Star, group: "Marketplace" },
  { href: "/admin/moderation", label: "Flagged messages", icon: MessageSquare, group: "Marketplace" },
  { href: "/admin/reports", label: "Reports", icon: Flag, group: "Marketplace" },
  { href: "/admin/requirements", label: "Requirements", icon: ListChecks, group: "Marketplace" },
  { href: "/admin/homepage", label: "Homepage", icon: House, group: "Content" },
  { href: "/admin/content", label: "Content", icon: BadgeCheck, group: "Content" },
  { href: "/admin/newsletter", label: "Newsletter", icon: Mail, group: "Content" },
  { href: "/admin/valuations", label: "Valuations", icon: Calculator, group: "Business" },
  { href: "/admin/analytics", label: "Analytics", icon: ChartColumn, group: "Business" },
  { href: "/admin/memberships", label: "Memberships", icon: CreditCard, group: "Business" },
  { href: "/admin/referrals", label: "Referrals", icon: Gift, group: "Business" },
  { href: "/admin/settings", label: "Settings", icon: Settings, group: "Business" },
];

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
    // Stacked on phones (nav scroller above content), two columns from lg up.
    <div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-12 lg:py-12">
      <aside className="min-w-0 space-y-6">
        <div className="space-y-1 border-b border-line pb-5">
          <p className="text-[11px] uppercase tracking-[0.25em] text-accent-text">Admin</p>
          <p className="truncate text-sm text-ink-soft">{admin.email}</p>
        </div>
        <AdminNav items={NAV} label="Admin" />
      </aside>
      <main className="min-w-0">{children}</main>
    </div>
  );
}
