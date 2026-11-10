"use client";

import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { Sidebar, type SidebarGroup } from "@/components/ui/sidebar";

export interface AdminNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  group: string;
}

/**
 * Admin navigation. Works out the active link from the current path so the server layout can stay static.
 * The longest matching href wins, so /admin/listings/all is not also marked on /admin/listings.
 */
export function AdminNav({ items, label }: { items: AdminNavItem[]; label: string }) {
  const pathname = usePathname();
  const active = items
    .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  const groups: SidebarGroup[] = [];
  for (const item of items) {
    let group = groups.find((g) => g.heading === item.group);
    if (!group) {
      group = { heading: item.group, items: [] };
      groups.push(group);
    }
    group.items.push({ href: item.href, label: item.label, icon: item.icon, active: item.href === active });
  }

  return <Sidebar groups={groups} label={label} />;
}
