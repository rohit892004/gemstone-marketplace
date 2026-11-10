import type { ReactNode } from "react";
import { cx } from "./cx";

/** Top of a page: gold eyebrow, serif title, optional lead paragraph and actions. Left-aligned on every screen. */
export function PageHeader({
  eyebrow,
  title,
  lead,
  actions,
  className,
  tone = "light",
}: {
  eyebrow?: string;
  title: string;
  lead?: ReactNode;
  actions?: ReactNode;
  className?: string;
  tone?: "light" | "dark";
}) {
  const dark = tone === "dark";
  return (
    <header className={cx("flex flex-wrap items-end justify-between gap-6 pb-10", className)}>
      <div className="max-w-3xl space-y-4">
        {eyebrow ? (
          <p className={cx("text-[11px] uppercase tracking-[0.28em]", dark ? "text-champagne" : "text-accent-text")}>{eyebrow}</p>
        ) : null}
        <h1 className={cx("font-heading text-4xl font-medium leading-[1.1] sm:text-5xl", dark ? "text-ivory" : "text-ink")}>{title}</h1>
        {lead ? <div className={cx("max-w-2xl text-base leading-relaxed", dark ? "text-ivory/75" : "text-ink-soft")}>{lead}</div> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
    </header>
  );
}

/** Section heading used inside pages. Smaller than PageHeader, with a thin rule underneath. */
export function SectionHeading({ eyebrow, title, action, className }: { eyebrow?: string; title: string; action?: ReactNode; className?: string }) {
  return (
    <div className={cx("flex flex-wrap items-end justify-between gap-6", className)}>
      <div className="space-y-3">
        {eyebrow ? <p className="text-[11px] uppercase tracking-[0.28em] text-accent-text">{eyebrow}</p> : null}
        <h2 className="font-heading text-3xl font-medium leading-tight text-ink sm:text-4xl">{title}</h2>
      </div>
      {action}
    </div>
  );
}
