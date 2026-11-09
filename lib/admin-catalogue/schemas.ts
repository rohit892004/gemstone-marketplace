import { z } from "zod";
import type { Prisma } from "@/app/generated/prisma/client";

/** Validation for the admin catalogue decisions and list filters. */

const id = z.string().trim().min(1).max(64);
const reason = z.string().trim().min(10, "Give a reason of at least 10 characters").max(1000);

export const listingIdSchema = z.object({ listingId: id });
export const listingRejectSchema = z.object({ listingId: id, reason });
export const featuredToggleSchema = z.object({
  listingId: id,
  featured: z.enum(["true", "false"]).transform((v) => v === "true"),
});

export const documentIdSchema = z.object({ documentId: id });
export const documentRejectSchema = z.object({ documentId: id, reason });

export const reviewDecisionSchema = z.object({ reviewId: id });

/** Rejecting a review needs a reason, like listings and documents. */
export const reviewRejectSchema = z.object({
  reviewId: id,
  reason: z.string().trim().min(10, "Give a reason of at least 10 characters").max(1000),
});

export const autoPublishSchema = z.object({
  autoPublish: z.enum(["on", "off"]).transform((v) => v === "on"),
});

/** Admin listing list filters. Unknown values fall back to "all" or page 1. */
export const LISTING_STATUS_FILTERS = ["all", "PENDING_REVIEW", "PUBLISHED", "DRAFT", "REJECTED", "ARCHIVED"] as const;
export const AVAILABILITY_FILTERS = ["all", "AVAILABLE", "RESERVED", "SOLD", "HIDDEN"] as const;
export const FEATURED_FILTERS = ["all", "yes", "no"] as const;
export const ADMIN_PAGE_SIZE = 25;

export const listingFilterSchema = z.object({
  status: z.enum(LISTING_STATUS_FILTERS).catch("all"),
  availability: z.enum(AVAILABILITY_FILTERS).catch("all"),
  featured: z.enum(FEATURED_FILTERS).catch("all"),
  seller: z.string().trim().max(80).catch(""),
  page: z.coerce.number().int().min(1).max(100000).catch(1),
});

export type ListingFilters = z.infer<typeof listingFilterSchema>;

/** Takes the first value when a search param repeats. */
function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function parseListingFilters(raw: Record<string, string | string[] | undefined>): ListingFilters {
  return listingFilterSchema.parse({
    status: first(raw.status),
    availability: first(raw.availability),
    featured: first(raw.featured),
    seller: first(raw.seller) ?? "",
    page: first(raw.page),
  });
}

export function listingWhere(filters: ListingFilters): Prisma.GemstoneWhereInput {
  const where: Prisma.GemstoneWhereInput = {};
  if (filters.status !== "all") where.status = filters.status;
  if (filters.availability !== "all") where.availability = filters.availability;
  if (filters.featured === "yes") where.featured = true;
  if (filters.featured === "no") where.featured = false;
  if (filters.seller) where.seller = { businessName: { contains: filters.seller, mode: "insensitive" } };
  return where;
}
