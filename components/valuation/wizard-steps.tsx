import { WIZARD_STEPS, stepText } from "@/lib/valuation/requester-copy";

/** "Step N of 3" with the three step names. Server-rendered. */
export function WizardSteps({ current }: { current: 1 | 2 | 3 }) {
  return (
    <nav aria-label="Valuation steps" className="space-y-2">
      <p className="text-sm font-medium text-accent">{stepText(current)}</p>
      <ol className="flex gap-2">
        {WIZARD_STEPS.map((s) => {
          const done = s.step < current;
          const active = s.step === current;
          return (
            <li
              key={s.step}
              aria-current={active ? "step" : undefined}
              className={`flex-1 border-t-2 pt-2 text-xs font-medium sm:text-sm ${
                active ? "border-brand-strong text-ink" : done ? "border-brand text-ink-soft" : "border-line text-ink-soft"
              }`}
            >
              {s.label}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
