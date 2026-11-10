"use client";

import { usePathname } from "next/navigation";
import {
  BarChart3,
  BadgeCheck,
  Boxes,
  ClipboardList,
  FileText,
  Gem,
  HandCoins,
  Inbox,
  LayoutDashboard,
  Crown,
  Images,
} from "lucide-react";
import { Sidebar, type SidebarGroup } from "@/components/ui/sidebar";

const groups = [
  { href: "/seller", label: "Overview", icon: LayoutDashboard },
  { href: "/seller/portfolio", label: "Portfolio", icon: Images },
  { href: "/seller/listings", label: "Listings", icon: Gem },
  { href: "/seller/inventory", label: "Inventory", icon: Boxes },
  { href: "/seller/inbox", label: "Inbox", icon: Inbox },
  { href: "/seller/requirements", label: "Requirements", icon: ClipboardList },
  { href: "/seller/quotations", label: "Quotations", icon: FileText },
  { href: "/seller/offers", label: "Offers", icon: HandCoins },
  { href: "/seller/valuations", label: "Valuations", icon: BadgeCheck },
  { href: "/seller/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/seller/membership", label: "Membership", icon: Crown },
] as const;

export const sellerNavItems = groups.map(({ href, label }) => ({ href, label }));

/** Seller sidebar. Two columns on lg, horizontal scroller on phones. Active page from the route. */
export function SellerNav() {
  const pathname = usePathname();
  const sections: SidebarGroup[] = [
    {
      heading: "Seller",
      items: groups.map((item) => ({
        href: item.href,
        label: item.label,
        icon: item.icon,
        active: item.href === "/seller" ? pathname === "/seller" : pathname === item.href || pathname.startsWith(`${item.href}/`),
      })),
    },
  ];
  return <Sidebar label="Seller" groups={sections} />;
}

