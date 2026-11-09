import type { Prisma, Role } from "@/app/generated/prisma/client";

/**
 * Who can see a listing. Single source of truth for public and private visibility.
 *
 * Public = listing PUBLISHED AND availability not HIDDEN AND seller APPROVED.
 * Sold listings stay public (marked Sold) so buyers can still reach them from links.
 * Documents and media follow the listing: they are never public on their own.
 */

/** Prisma filter for public listings. Use on every public query. */
export function publicListingWhere(): Prisma.GemstoneWhereInput {
  return {
    status: "PUBLISHED",
    availability: { not: "HIDDEN" },
    seller: { approvalStatus: "APPROVED" },
  };
}

export interface ViewerLike {
  id: string;
  role: Role;
}

export interface ListingForVisibility {
  status: string;
  availability: string;
  seller: { approvalStatus: string; userId: string };
}

/** True when `viewer` may see the listing (public or owner/admin). */
export function canViewListing(listing: ListingForVisibility, viewer: ViewerLike | null): boolean {
  if (viewer?.role === "ADMIN") return true;
  if (viewer && viewer.id === listing.seller.userId) return true;
  return (
    listing.status === "PUBLISHED" &&
    listing.availability !== "HIDDEN" &&
    listing.seller.approvalStatus === "APPROVED"
  );
}

/** True when `viewer` owns the listing's seller account. Used to block self-enquiries and self-wishlisting. */
export function isOwnListing(listing: { seller: { userId: string } }, viewerId: string | null | undefined): boolean {
  return !!viewerId && listing.seller.userId === viewerId;
}
