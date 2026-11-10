import { progressLabel, progressPercent, type ProgressFormat } from "@/lib/membership/progress";
import type { Criterion } from "@/lib/membership/tiers";

/**
 * One criterion toward the next tier. The text (current of required, and met or not yet met) sits beside the bar,
 * so the state is never carried by colour or the bar alone. The bar is a native progress element.
 */
export function ProgressBar({ label, current, required, met, format }: { label: string; current: number; required: number; met: boolean; format?: ProgressFormat }) {
  const text = progressLabel({ label, current, required, met, format });
  const percent = progressPercent(current, required);
  return (
    <div className="space-y-1">
      <p className="text-sm text-ink">{text}</p>
      <progress className="h-2 w-full overflow-hidden rounded-full" value={percent} max={100} aria-label={`${label} progress`}>
        {percent}%
      </progress>
    </div>
  );
}

export function CriterionProgress({ criterion, format }: { criterion: Criterion; format: ProgressFormat }) {
  return <ProgressBar label={criterion.label} current={criterion.current} required={criterion.required} met={criterion.met} format={format} />;
}
