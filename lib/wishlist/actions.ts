"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertNotOwnBusiness, OwnBusinessError, requireBuyerFeatures } from "@/lib/auth/buyer-access";
import { AuthzError } from "@/lib/auth/require-role";
import { prisma } from "@/lib/db/client";
import { publicListingWhere } from "@/lib/listings/visibility";
import { WISHLIST_GENERIC_ERROR } from "./constants";

/**
 * Wishlist server actions. Both call requireBuyerFeatures() first; the acting user always comes
 * from the server session, never from the client.
 *
 * addToWishlist: the listing must be publicly visible, and the acting user must not own the seller.
 * removeFromWishlist: only touches the caller's own rows. It does not require the listing to be
 * public, so buyers can clear items that have since been hidden ("No longer available").
 *
 * Both are idempotent (upsert / deleteMany).
 */

export type WishlistResult = { ok: true; saved: boolean } | { ok: false; error: string };

const listingIdSchema = z.string().trim().min(1).max(64);

export async function addToWishlist(listingId: string): Promise<WishlistResult> {
  const parsed = listingIdSchema.safeParse(listingId);
  if (!parsed.success) return { ok: false, error: WISHLIST_GENERIC_ERROR };

  try {
    const user = await requireBuyerFeatures();

    const listing = await prisma.gemstone.findFirst({
      where: { id: parsed.data, ...publicListingWhere() },
      select: { id: true, seller: { select: { userId: true } } },
    });
    if (!listing) return { ok: false, error: WISHLIST_GENERIC_ERROR };

    assertNotOwnBusiness(user.id, listing.seller.userId);

    await prisma.wishlistItem.upsert({
      where: { buyerId_gemstoneId: { buyerId: user.id, gemstoneId: listing.id } },
      create: { buyerId: user.id, gemstoneId: listing.id },
      update: {},
    });
    revalidatePath("/buyer/wishlist");
    return { ok: true, saved: true };
  } catch (err) {
    if (err instanceof AuthzError || err instanceof OwnBusinessError) {
      return { ok: false, error: WISHLIST_GENERIC_ERROR };
    }
    throw err;
  }
}

export async function removeFromWishlist(listingId: string): Promise<WishlistResult> {
  const parsed = listingIdSchema.safeParse(listingId);
  if (!parsed.success) return { ok: false, error: WISHLIST_GENERIC_ERROR };

  try {
    const user = await requireBuyerFeatures();
    await prisma.wishlistItem.deleteMany({
      where: { buyerId: user.id, gemstoneId: parsed.data },
    });
    revalidatePath("/buyer/wishlist");
    return { ok: true, saved: false };
  } catch (err) {
    if (err instanceof AuthzError) return { ok: false, error: WISHLIST_GENERIC_ERROR };
    throw err;
  }
}
