import { cache } from "react";
import type { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/db/client";
import { type CatalogueResult, loadCards } from "@/lib/listings/search";
import { PAGE_SIZE } from "@/lib/listings/schema";
import { publicListingWhere } from "@/lib/listings/visibility";

/**
 * Public seller portfolio queries. Every query here either filters on
 * approvalStatus APPROVED (sellers) or spreads publicListingWhere() (listings).
 * Select lists are explicit: no email, mobile, GST, address, pincode or documents.
 */

export interface PublicSellerProfile {
  id: string;
  slug: string;
  businessName: string;
  tagline: string | null;
  description: string | null;
  specialties: string[];
  city: string;
  state: string;
  country: string;
  yearsInBusiness: number | null;
  ratingAverage: string | null;
  reviewCount: number;
  isDemo: boolean;
}

export const getPublicSellerBySlug = cache(async (slug: string): Promise<PublicSellerProfile | null> => {
  const row = await prisma.sellerProfile.findFirst({
    where: { slug, approvalStatus: "APPROVED" },
    select: {
      id: true,
      slug: true,
      businessName: true,
      tagline: true,
      description: true,
      specialties: true,
      city: true,
      state: true,
      country: true,
      yearsInBusiness: true,
      ratingAverage: true,
      reviewCount: true,
      isDemo: true,
    },
  });
  if (!row) return null;
  return { ...row, ratingAverage: row.ratingAverage ? row.ratingAverage.toString() : null };
});

export interface PublicReview {
  id: string;
  authorName: string;
  rating: number;
  title: string | null;
  body: string;
  createdAt: Date;
  isDemo: boolean;
}

/** Approved reviews only. Writing reviews is M3. */
export async function getApprovedReviews(sellerId: string, take = 20): Promise<PublicReview[]> {
  return prisma.review.findMany({
    where: { sellerId, status: "APPROVED" },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    take,
    select: { id: true, authorName: true, rating: true, title: true, body: true, createdAt: true, isDemo: true },
  });
}

/**
 * A seller's public gemstones, paginated. The where clause always spreads
 * publicListingWhere(), so drafts, hidden, unpublished and unapproved-seller listings
 * never appear. Cards are loaded through the shared loadCards().
 */
export async function listSellerGemstones(sellerId: string, page: number): Promise<CatalogueResult> {
  const where: Prisma.GemstoneWhereInput = { ...publicListingWhere(), sellerId };
  const skip = (page - 1) * PAGE_SIZE;
  const [rows, total] = await Promise.all([
    prisma.gemstone.findMany({
      where,
      orderBy: [{ publishedAt: { sort: "desc", nulls: "last" } }, { id: "asc" }],
      skip,
      take: PAGE_SIZE,
      select: { id: true },
    }),
    prisma.gemstone.count({ where }),
  ]);
  const items = await loadCards(rows.map((r) => r.id));
  return { items, total, page, pageSize: PAGE_SIZE };
}
