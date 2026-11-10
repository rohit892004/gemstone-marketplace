"use client";

import { usePathname } from "next/navigation";
import { Tabs } from "@/components/ui/tabs";

export interface SectionTab {
  href: string;
  label: string;
}

/**
 * Route tabs for a section that has several admin pages. Marks the tab whose href is the longest prefix of
 * the current path, so /admin/valuations is not active on /admin/valuations/prices.
 */
export function SectionTabs({ items, label }: { items: SectionTab[]; label: string }) {
  const pathname = usePathname();
  const active = items
    .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
  return <Tabs label={label} items={items.map((item) => ({ ...item, active: item.href === active }))} />;
}
