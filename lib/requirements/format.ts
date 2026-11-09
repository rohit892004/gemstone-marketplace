import { formatMoney } from "@/lib/money/money";

/** Display helpers for requirement facts. Output is plain text. */

function range(from: string | null, to: string | null, unit: string): string | null {
  if (from && to) return `${from} to ${to}${unit}`;
  if (from) return `From ${from}${unit}`;
  if (to) return `Up to ${to}${unit}`;
  return null;
}

/** "1.5 to 3 ct", "From 1 ct", or null when neither bound is set. */
export function formatCaratRange(min: { toString(): string } | null, max: { toString(): string } | null): string | null {
  return range(min ? trimZeros(min.toString()) : null, max ? trimZeros(max.toString()) : null, " ct");
}

/** "INR 5,00,000 to INR 9,00,000", or null when neither bound is set. */
export function formatBudgetRange(min: bigint | null, max: bigint | null, currency: string): string | null {
  return range(
    min === null ? null : formatMoney(min, currency),
    max === null ? null : formatMoney(max, currency),
    "",
  );
}

function trimZeros(value: string): string {
  return value.includes(".") ? value.replace(/\.?0+$/, "") : value;
}
