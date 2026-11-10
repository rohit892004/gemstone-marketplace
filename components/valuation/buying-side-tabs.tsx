import { Tabs } from "@/components/ui/tabs";

/**
 * Tabs for the buying side of a seller account. The buyer area is closed to sellers (proxy.ts), so the seller's
 * valuations and saved reports live under /seller and use these tabs. Buyers use the tabs in app/buyer/layout.tsx.
 */
export function BuyingSideTabs({ current }: { current: "valuations" | "reports" }) {
  return (
    <Tabs
      label="Buying-side valuation sections"
      className="mt-2"
      items={[
        { href: "/seller/valuations", label: "Valuations", active: current === "valuations" },
        { href: "/seller/reports", label: "Saved reports", active: current === "reports" },
      ]}
    />
  );
}
