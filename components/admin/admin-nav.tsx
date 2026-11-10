"use client";

import { usePathname } from "next/navigation";
import {
  type LucideIcon,
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
import { Sidebar, type SidebarGroup } from "@/components/ui/sidebar";

interface AdminNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  group: string;
}

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
 * Admin navigation. Works out the active link from the current path so the server layout can stay static.
 * The longest matching href wins, so /admin/listings/all is not also marked on /admin/listings.
 */
export function AdminNav({ label }: { label: string }) {
  const pathname = usePathname();
  const active = NAV
    .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  const groups: SidebarGroup[] = [];
  for (const item of NAV) {
    let group = groups.find((g) => g.heading === item.group);
    if (!group) {
      group = { heading: item.group, items: [] };
      groups.push(group);
    }
    group.items.push({ href: item.href, label: item.label, icon: item.icon, active: item.href === active });
  }

  return <Sidebar groups={groups} label={label} />;
}
