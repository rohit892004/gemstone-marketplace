import type { ReactNode } from "react";
import { SectionTabs } from "@/components/admin/section-tabs";

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
    <div className="space-y-10">
      <SectionTabs items={SECTIONS} label="Valuation sections" />
      {children}
    </div>
  );
}
