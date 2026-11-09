import type { Role } from "@/app/generated/prisma/client";

/**
 * Pure role and ownership rules shared by the buyer-side features (requirements, offers, enquiries).
 * Sellers act as buyers on OTHER sellers' listings and requirements. These checks are the server's
 * source of truth; the UI only hides what these refuse.
 */

export interface TransactingUser {
  role: Role;
  /** SellerProfile.approvalStatus. Null for buyers and admins. */
  approvalStatus: string | null;
}

/** Buyers, and sellers who are approved. Pending, rejected or suspended sellers cannot transact. */
export function canTransact(user: TransactingUser): boolean {
  if (user.role === "BUYER") return true;
  return user.role === "SELLER" && user.approvalStatus === "APPROVED";
}

/** A user may never enquire about, offer on or quote against their own listing. */
export function isOwnListing(actingUserId: string, listingSellerUserId: string): boolean {
  return actingUserId === listingSellerUserId;
}

/** A user never responds to, or sees on the board, a requirement they posted. */
export function isOwnRequirement(actingUserId: string, requirementBuyerId: string): boolean {
  return actingUserId === requirementBuyerId;
}
