import type { ReactNode } from "react";
import { ShieldCheck } from "lucide-react";
import { cx } from "./cx";

export type BadgeTone = "neutral" | "accent" | "verified" | "success" | "warning" | "danger";

const tones: Record<BadgeTone, string> = {
  neutral: "border-line text-ink-soft",
  accent: "border-accent/40 text-accent-text",
  verified: "border-accent/40 text-accent-text",
  success: "border-success/40 text-success",
  warning: "border-accent/60 bg-accent-soft text-accent-text",
  danger: "border-danger/40 text-danger",
};

/** Small status label. Text always carries the meaning; colour only supports it. */
export function Badge({ tone = "neutral", children, className }: { tone?: BadgeTone; children: ReactNode; className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-1.5 whitespace-nowrap border px-2 py-0.5 text-[11px] uppercase tracking-[0.14em]", tones[tone], className)}>
      {tone === "verified" ? <ShieldCheck className="h-3.5 w-3.5" strokeWidth={1.25} aria-hidden /> : null}
      {children}
    </span>
  );
}

/** Quiet marker that every demo record carries. Required on demo content, never styled loudly. */
export function DemoTag() {
  return <span className="text-[10px] uppercase tracking-[0.22em] text-ink-soft">Demo</span>;
}
