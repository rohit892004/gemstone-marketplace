import { Check } from "lucide-react";
import { WIZARD_STEPS, stepText } from "@/lib/valuation/requester-copy";
import { cx } from "@/components/ui/cx";

/** "Step N of 3" with the three step names, as a thin numbered rail. Server-rendered. */
export function WizardSteps({ current }: { current: 1 | 2 | 3 }) {
  return (
    <nav aria-label="Valuation steps" className="space-y-3">
      <p className="text-[11px] uppercase tracking-[0.28em] text-accent-text">{stepText(current)}</p>
      <ol className="grid grid-cols-3 gap-3 sm:gap-6">
        {WIZARD_STEPS.map((s) => {
          const done = s.step < current;
          const active = s.step === current;
          return (
            <li
              key={s.step}
              aria-current={active ? "step" : undefined}
              className={cx(
                "flex items-center gap-2 border-t-2 pt-3 text-[13px] sm:text-sm",
                active ? "border-accent font-medium text-ink" : done ? "border-brand text-ink" : "border-line text-ink-soft",
              )}
            >
              <span className={cx("font-heading text-lg leading-none", active ? "text-accent-text" : "text-ink-soft")} aria-hidden>
                {done ? <Check className="h-4 w-4" strokeWidth={1.5} /> : String(s.step).padStart(2, "0")}
              </span>
              <span>{s.label}</span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
