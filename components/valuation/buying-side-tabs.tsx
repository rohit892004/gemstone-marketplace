import Link from "next/link";

/**
 * Tabs for the buying side of a seller account. The buyer area is closed to sellers (proxy.ts), so the seller's
 * valuations and saved reports live under /seller and use these tabs. Buyers use the tabs in app/buyer/layout.tsx.
 */
export function BuyingSideTabs({ current }: { current: "valuations" | "reports" }) {
  const tabs = [
    { href: "/seller/valuations", label: "Valuations", key: "valuations" },
    { href: "/seller/reports", label: "Saved reports", key: "reports" },
  ] as const;
  return (
    <nav aria-label="Buying-side valuation sections" className="mt-2 border-b border-line">
      <ul className="-mb-px flex gap-1 overflow-x-auto">
        {tabs.map((tab) => {
          const active = tab.key === current;
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`inline-block whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium ${
                  active ? "border-brand-strong text-ink" : "border-transparent text-ink-soft hover:text-ink"
                }`}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
