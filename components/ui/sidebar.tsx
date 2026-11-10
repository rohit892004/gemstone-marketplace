import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cx } from "./cx";

export interface SidebarItem {
  href: string;
  label: string;
  icon: LucideIcon;
  active?: boolean;
  /** Small count shown at the end, e.g. unread messages. */
  badge?: number;
}

export interface SidebarGroup {
  heading?: string;
  items: SidebarItem[];
}

/**
 * Dashboard navigation. Desktop: a fixed column with grouped links. Phone: the same links in a horizontal
 * scroller at the top, so the page never overflows. Links carry aria-current for the active page.
 * Lay it out in a two-column grid on lg screens: sidebar in the first column, page content in the second.
 */
export function Sidebar({ groups, label, footer }: { groups: SidebarGroup[]; label: string; footer?: ReactNode }) {
  return (
    <nav aria-label={label} className="lg:sticky lg:top-6 lg:self-start">
      <div className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:overflow-visible lg:px-0">
        <div className="flex gap-8 lg:flex-col lg:gap-8">
          {groups.map((group, gi) => (
            <div key={group.heading ?? gi} className="min-w-max lg:min-w-0">
              {group.heading ? <p className="mb-3 hidden text-[11px] uppercase tracking-[0.25em] text-accent-text lg:block">{group.heading}</p> : null}
              <ul className="flex gap-1 lg:flex-col lg:gap-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={item.active ? "page" : undefined}
                        className={cx(
                          "flex items-center gap-3 px-3 py-2.5 text-sm tracking-wide transition duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                          item.active ? "bg-accent-soft text-ink lg:border-l-2 lg:border-accent" : "text-ink-soft hover:bg-surface-raised hover:text-ink",
                        )}
                      >
                        <Icon className={cx("h-4 w-4 shrink-0", item.active ? "text-accent" : "")} strokeWidth={1.25} aria-hidden />
                        <span className="whitespace-nowrap">{item.label}</span>
                        {typeof item.badge === "number" && item.badge > 0 ? (
                          <span className="ml-auto bg-brand px-1.5 py-0.5 text-[11px] tabular-nums text-ivory">{item.badge}</span>
                        ) : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </div>
      {footer ? <div className="mt-8 hidden border-t border-line pt-6 text-sm text-ink-soft lg:block">{footer}</div> : null}
    </nav>
  );
}
