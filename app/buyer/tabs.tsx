"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BUYER_TABS } from "./tab-list";

/** Tab nav shared by /buyer/* and /account. */
export function BuyerTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="Buyer account sections" className="mt-8 border-b border-line">
      <ul className="-mb-px flex gap-1 overflow-x-auto">
        {BUYER_TABS.map((tab) => {
          const active = pathname === tab.href;
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
