import { cache } from "react";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/client";
import { loadCards, type ListingCard } from "@/lib/listings/search";
import { isPubliclyVisible } from "@/lib/seller-public/visibility";

export type WishlistViewerState =
  | { kind: "signed-out" }
  | { kind: "owner" }
  | { kind: "unavailable" }
  | { kind: "ready"; saved: boolean };

/**
 * What the product page may show for the current visitor. The session is read on the server;
 * a verified, active BUYER or SELLER (not the seller who owns the listing) gets the save button.
 */
export async function getWishlistViewerState(gemstoneId: string, sellerUserId: string): Promise<WishlistViewerState> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { kind: "signed-out" };
  if (userId === sellerUserId) return { kind: "owner" };

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, status: true, emailVerifiedAt: true },
  });
  if (!user || user.status !== "ACTIVE" || !user.emailVerifiedAt) return { kind: "unavailable" };
  if (user.role !== "BUYER" && user.role !== "SELLER") return { kind: "unavailable" };

  const item = await prisma.wishlistItem.findUnique({
    where: { buyerId_gemstoneId: { buyerId: userId, gemstoneId } },
    select: { gemstoneId: true },
  });
  return { kind: "ready", saved: !!item };
}

export interface WishlistRow {
  gemstoneId: string;
  /** Card data when the listing is still public; null renders "No longer available". */
  card: ListingCard | null;
}

/** The buyer's wishlist in saved order. Hidden or unpublished listings come back with card = null. */
export const listWishlist = cache(async (buyerId: string): Promise<WishlistRow[]> => {
  const items = await prisma.wishlistItem.findMany({
    where: { buyerId },
    orderBy: { createdAt: "desc" },
    select: {
      gemstoneId: true,
      gemstone: {
        select: { status: true, availability: true, seller: { select: { approvalStatus: true } } },
      },
    },
  });
  const visibleIds = items.filter((i) => isPubliclyVisible(i.gemstone)).map((i) => i.gemstoneId);
  const cards = await loadCards(visibleIds);
  const byId = new Map(cards.map((c) => [c.id, c]));
  return items.map((i) => ({ gemstoneId: i.gemstoneId, card: byId.get(i.gemstoneId) ?? null }));
});
