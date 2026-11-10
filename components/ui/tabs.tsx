import Link from "next/link";
import type { ReactNode } from "react";
import { cx } from "./cx";

export interface TabItem {
  href: string;
  label: ReactNode;
  /** True for the current route. Sets aria-current="page". */
  active?: boolean;
  count?: number;
}

/**
 * Route-based tabs for dashboards and filtered lists. Each tab is a real link, so it works without JavaScript,
 * keeps the browser history, and survives a reload. Uses the nav landmark with aria-current, not an ARIA tablist.
 */
export function Tabs({ items, label, className }: { items: TabItem[]; label: string; className?: string }) {
  return (
    <nav aria-label={label} className={cx("-mx-4 overflow-x-auto border-b border-line px-4 sm:mx-0 sm:px-0", className)}>
      <ul className="flex min-w-max gap-6">
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={item.active ? "page" : undefined}
              className={cx(
                "relative inline-flex items-center gap-2 pb-3 text-sm tracking-wide transition duration-300",
                item.active ? "text-ink" : "text-ink-soft hover:text-ink",
              )}
            >
              {item.label}
              {typeof item.count === "number" ? <span className="text-[12px] text-ink-soft">{item.count}</span> : null}
              <span
                aria-hidden
                className={cx("absolute inset-x-0 -bottom-px h-px transition duration-300", item.active ? "bg-accent" : "bg-transparent")}
              />
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
