import type { Role } from "@/app/generated/prisma/client";
import { type CurrentUser, requireRole } from "./require-role";

/**
 * Buyer features (wishlist, enquiries, reviews, valuations) are open to BUYER and SELLER.
 * A user still has one role; sellers simply pass buyer-feature checks too.
 *
 * Sellers must never act on their own listings or business (enquire, wishlist, review).
 * Use `assertNotOwnBusiness` with the target seller's userId before writing.
 */

export const BUYER_FEATURE_ROLES: readonly Role[] = ["BUYER", "SELLER"];

/** Requires a signed-in buyer or seller. Throws AuthzError like requireRole. */
export function requireBuyerFeatures(): Promise<CurrentUser> {
  return requireRole(BUYER_FEATURE_ROLES);
}

/** Throws OWN_BUSINESS when the acting user owns the target seller account. */
export class OwnBusinessError extends Error {
  readonly code = "OWN_BUSINESS" as const;
  constructor() {
    super("OWN_BUSINESS");
    this.name = "OwnBusinessError";
  }
}

export function assertNotOwnBusiness(actingUserId: string, sellerUserId: string): void {
  if (actingUserId === sellerUserId) throw new OwnBusinessError();
}
