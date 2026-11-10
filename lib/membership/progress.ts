/**
 * Progress toward a tier, as text and a percentage. Pure. The text is always shown beside the bar, so the state is
 * never carried by colour alone.
 */

export type ProgressFormat = "count" | "percent" | "rating";

/** 0 to 100, rounded down. A requirement of 0 (or less) counts as complete. Current values above the requirement cap at 100. */
export function progressPercent(current: number, required: number): number {
  if (!Number.isFinite(current) || !Number.isFinite(required)) return 0;
  if (required <= 0) return 100;
  const pct = Math.floor((Math.max(current, 0) / required) * 100);
  return Math.min(100, Math.max(0, pct));
}

function formatValue(value: number, format: ProgressFormat): string {
  if (format === "percent") return `${Math.round(value)}%`;
  if (format === "rating") return value.toFixed(1);
  return String(Math.round(value));
}

/** For example "3 of 5 Qualified referrals, not yet met" or "72% of 70% Response rate, met". */
export function progressLabel(input: { label: string; current: number; required: number; met: boolean; format?: ProgressFormat }): string {
  const format = input.format ?? "count";
  const status = input.met ? "met" : "not yet met";
  return `${formatValue(input.current, format)} of ${formatValue(input.required, format)} ${input.label}, ${status}`;
}

/** The format each criterion is shown in. */
export function criterionFormat(key: "referrals" | "followers" | "response" | "rating"): ProgressFormat {
  if (key === "response") return "percent";
  if (key === "rating") return "rating";
  return "count";
}
