import { formatMoney } from "@/lib/money/money";

/** Display helpers for the valuation pages. Pure. */

const CARAT_FORMAT = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 3, minimumFractionDigits: 0 });

/** Carat is stored in thousandths. 2500 becomes "2.5". */
export function formatCarat(caratMilli: number | null | undefined): string {
  if (caratMilli === null || caratMilli === undefined) return "-";
  return `${CARAT_FORMAT.format(caratMilli / 1000)} ct`;
}

export const VALUATION_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  AUTO_VALUED: "Auto valued",
  IN_EXPERT_REVIEW: "In expert review",
  NEEDS_INFO: "Needs info",
  COMPLETED: "Completed",
  REJECTED: "Rejected",
};

export function statusLabel(status: string): string {
  return VALUATION_STATUS_LABELS[status] ?? status;
}

export const CONFIDENCE_LABELS: Record<string, string> = { LOW: "Low", MEDIUM: "Medium", HIGH: "High" };

/** Thread authors are shown by role only, never by name. */
export const THREAD_FROM_LABELS: Record<"REQUESTER" | "VALUATOR" | "ADMIN", string> = {
  REQUESTER: "Requester",
  VALUATOR: "Valuer",
  ADMIN: "Admin",
};

export const THREAD_KIND_LABELS: Record<string, string> = {
  INFO_REQUEST: "Question",
  INFO_RESPONSE: "Reply",
  SIGNOFF: "Sign-off note",
  NOTE: "Note",
  ADMIN: "Admin note",
};

/** Money in minor units for display, or a dash when there is no amount. */
export function money(minor: bigint | null | undefined, currency: string): string {
  return formatMoney(minor ?? null, currency) ?? "-";
}
