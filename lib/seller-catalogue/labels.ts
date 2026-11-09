import { formatMoney } from "@/lib/money/money";

export const listingStatusLabels: Record<string, string> = {
  DRAFT: "Draft",
  PENDING_REVIEW: "Awaiting review",
  PUBLISHED: "Published",
  REJECTED: "Rejected",
  ARCHIVED: "Archived",
};

export const availabilityLabels: Record<string, string> = {
  AVAILABLE: "Available",
  RESERVED: "Reserved",
  SOLD: "Sold",
  HIDDEN: "Hidden",
};

/** Price for the seller's table: formatted amount, or "On request". */
export function priceLabel(input: { priceMinor: bigint | null; priceOnRequest: boolean; currency: string }): string {
  if (input.priceOnRequest || input.priceMinor === null) return "On request";
  return formatMoney(input.priceMinor, input.currency) ?? "On request";
}
