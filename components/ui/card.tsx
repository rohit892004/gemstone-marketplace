import type { ReactNode } from "react";
import { cx } from "./cx";

/** Thin-bordered surface with a small radius and soft shadow. No grey fills, no heavy rounding. */
export function Card({ children, className, as: Tag = "div" }: { children: ReactNode; className?: string; as?: "div" | "section" | "article" }) {
  return <Tag className={cx("border border-line bg-surface-raised shadow-soft", className)}>{children}</Tag>;
}

/** Dashboard KPI tile: small caps label, serif figure, optional trend line and icon. */
export function StatTile({
  label,
  value,
  note,
  icon,
  className,
}: {
  label: string;
  value: ReactNode;
  note?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("flex flex-col gap-3 border border-line bg-surface-raised p-5 sm:p-6", className)}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] uppercase tracking-[0.2em] text-ink-soft">{label}</p>
        {icon ? <span className="text-accent" aria-hidden>{icon}</span> : null}
      </div>
      <p className="font-heading text-3xl text-ink sm:text-4xl">{value}</p>
      {note ? <p className="text-[12px] text-ink-soft">{note}</p> : null}
    </div>
  );
}
