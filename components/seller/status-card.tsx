import type { ReactNode } from "react";
import { AlertTriangle, Info } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cx } from "@/components/ui/cx";

/** Status panel for seller states (under review, rejected). Renders only the text it is given. */
export function StatusCard({ title, children, tone = "neutral" }: { title: string; children: ReactNode; tone?: "neutral" | "warn" }) {
  const Icon = tone === "warn" ? AlertTriangle : Info;
  return (
    <Card as="section" className={cx("flex gap-5 p-6 sm:p-8", tone === "warn" && "border-danger/40")}>
      <span className={cx("mt-1 hidden h-10 w-10 shrink-0 place-items-center border sm:grid", tone === "warn" ? "border-danger/40 text-danger" : "border-line text-accent")} aria-hidden>
        <Icon className="h-5 w-5" strokeWidth={1.25} />
      </span>
      <div className="min-w-0 space-y-3">
        <h2 className="font-heading text-2xl text-ink">{title}</h2>
        <div className="space-y-3 text-[15px] leading-relaxed text-ink-soft">{children}</div>
      </div>
    </Card>
  );
}
