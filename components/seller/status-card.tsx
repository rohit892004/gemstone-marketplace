import type { ReactNode } from "react";

/** Neutral card used for seller status messages. Renders only the text it is given. */
export function StatusCard({ title, children, tone = "neutral" }: { title: string; children: ReactNode; tone?: "neutral" | "warn" }) {
  const toneClass = tone === "warn" ? "border-red-300 bg-red-50" : "border-line bg-surface-raised";
  return (
    <section className={`rounded-lg border p-6 ${toneClass}`} aria-labelledby="status-title">
      <h2 id="status-title" className="text-lg font-semibold text-ink">
        {title}
      </h2>
      <div className="mt-2 space-y-3 text-sm text-ink-soft">{children}</div>
    </section>
  );
}
