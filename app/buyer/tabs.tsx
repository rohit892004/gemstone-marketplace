"use client";

import { usePathname } from "next/navigation";
import { BadgeCheck, BarChart3, ClipboardList, Heart, LayoutDashboard, MessagesSquare, Send } from "lucide-react";
import { Sidebar, type SidebarItem } from "@/components/ui/sidebar";
import { BUYER_TABS } from "./tab-list";

const icons: Record<string, SidebarItem["icon"]> = {
  "/buyer/wishlist": Heart,
  "/buyer/enquiries": Send,
  "/buyer/conversations": MessagesSquare,
  "/buyer/requirements": ClipboardList,
  "/buyer/valuations": BadgeCheck,
  "/buyer/reports": BarChart3,
};

/** Buyer sidebar. Two columns on lg, horizontal scroller on phones. */
export function BuyerTabs() {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const items: SidebarItem[] = [
    { href: "/buyer", label: "Overview", icon: LayoutDashboard, active: pathname === "/buyer" },
    ...BUYER_TABS.map((tab) => ({ href: tab.href, label: tab.label, icon: icons[tab.href], active: isActive(tab.href) })),
  ];
  return <Sidebar label="Buyer account sections" groups={[{ heading: "Buyer", items }]} />;
}
