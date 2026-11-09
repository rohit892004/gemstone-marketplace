import { formatMoney } from "@/lib/quotations/validate";

/** Display helpers for requirement cards and detail pages. Pure and client-safe. */

export function caratLabel(min: string | null, max: string | null): string {
  if (min && max) return `${min} to ${max} ct`;
  if (min) return `From ${min} ct`;
  if (max) return `Up to ${max} ct`;
  return "Any carat";
}

export function budgetLabel(min: bigint | null, max: bigint | null, currency: string): string {
  if (min !== null && max !== null) return `${formatMoney(min, currency)} to ${formatMoney(max, currency)}`;
  if (min !== null) return `From ${formatMoney(min, currency)}`;
  if (max !== null) return `Up to ${formatMoney(max, currency)}`;
  return "Not stated";
}
