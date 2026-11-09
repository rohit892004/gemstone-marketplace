import { z } from "zod";
import { ListingStatus } from "@/app/generated/prisma/client";

export const LISTINGS_PAGE_SIZE = 25;

const statusFilterValues = ["ALL", ...Object.values(ListingStatus)] as const;

export const listingsQuerySchema = z.object({
  status: z.enum(statusFilterValues).catch("ALL"),
  page: z.coerce.number().int().min(1).max(10000).catch(1),
});

export type ListingStatusFilter = (typeof statusFilterValues)[number];

/** Parses raw search params. Invalid values fall back to the defaults (ALL, page 1). */
export function parseListingsQuery(raw: Record<string, string | string[] | undefined>): {
  status: ListingStatusFilter;
  page: number;
} {
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const parsed = listingsQuerySchema.parse({ status: first(raw.status), page: first(raw.page) });
  return { status: parsed.status, page: parsed.page };
}

export function pageCount(total: number, pageSize = LISTINGS_PAGE_SIZE): number {
  return Math.max(1, Math.ceil(total / pageSize));
}

/** Clamps a requested page to the valid range and returns skip/take for Prisma. */
export function pageWindow(requestedPage: number, total: number, pageSize = LISTINGS_PAGE_SIZE) {
  const pages = pageCount(total, pageSize);
  const page = Math.min(Math.max(1, requestedPage), pages);
  return { page, pages, skip: (page - 1) * pageSize, take: pageSize };
}
