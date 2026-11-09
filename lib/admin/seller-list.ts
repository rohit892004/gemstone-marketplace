import { z } from "zod";
import type { ApprovalStatus, Prisma } from "@/app/generated/prisma/client";

/** Filters for the admin sellers list. "all" means no status filter. */
export const SELLER_STATUS_FILTERS = ["all", "PENDING", "APPROVED", "REJECTED", "SUSPENDED"] as const;
export type SellerStatusFilter = (typeof SELLER_STATUS_FILTERS)[number];

export const SELLER_PAGE_SIZE = 25;

/** Unknown or malformed values fall back to the defaults instead of erroring. */
export const sellerListParamsSchema = z.object({
  status: z.enum(SELLER_STATUS_FILTERS).catch("PENDING"),
  page: z.coerce.number().int().min(1).max(100000).catch(1),
});

export type SellerListParams = z.infer<typeof sellerListParamsSchema>;

/** Takes the first value when a search param repeats (?status=a&status=b). */
function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function parseSellerListParams(raw: Record<string, string | string[] | undefined>): SellerListParams {
  return sellerListParamsSchema.parse({ status: first(raw.status), page: first(raw.page) });
}

export function sellerWhere(status: SellerStatusFilter): Prisma.SellerProfileWhereInput {
  if (status === "all") return {};
  return { approvalStatus: status as ApprovalStatus };
}
