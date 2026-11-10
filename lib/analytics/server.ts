import { cookies, headers } from "next/headers";
import { prisma } from "@/lib/db/client";
import type { EventKind } from "./events";
import { recordEvent, VISITOR_COOKIE } from "./tracking";

/**
 * Server-side events, recorded by the action that caused them (wishlist, enquiry, quotation, valuation). Call it
 * without await: the action does not wait for tracking, and a failure never reaches the user.
 *
 * The visitor comes from the first-party cookie, the user agent from the request, and the actor from the session.
 * recordEvent applies the same rules as the browser path (staff, bots, a seller's own pages, deduplication).
 */

export interface ServerTrackInput {
  kind: EventKind;
  /** SellerProfile id (not the user id). */
  sellerId?: string | null;
  gemstoneId?: string | null;
  categoryId?: string | null;
  /** The user who owns the seller profile or listing, so their own actions do not count. */
  ownerUserId?: string | null;
}

export async function trackServer(input: ServerTrackInput): Promise<void> {
  try {
    // Read the request-scoped values first, before any other await, so they come from this request.
    const cookieStore = await cookies();
    const requestHeaders = await headers();
    // Loaded here, not at the top, so services that record events do not pull in the auth library.
    const { auth } = await import("@/lib/auth/auth");
    const session = await auth();
    const visitorId = cookieStore.get(VISITOR_COOKIE)?.value ?? null;

    await recordEvent({
      kind: input.kind,
      visitorId,
      sellerId: input.sellerId ?? null,
      gemstoneId: input.gemstoneId ?? null,
      categoryId: input.categoryId ?? null,
      ownerUserId: input.ownerUserId ?? null,
      actorRole: session?.user?.role ?? null,
      actorUserId: session?.user?.id ?? null,
      userAgent: requestHeaders.get("user-agent"),
    });
  } catch (error) {
    console.error("[analytics] server event not recorded", input.kind, error);
  }
}

/** The SellerProfile id for a user, for events that name the seller. Null when the user has no seller profile. */
export async function sellerProfileIdForUser(userId: string): Promise<string | null> {
  try {
    const profile = await prisma.sellerProfile.findUnique({ where: { userId }, select: { id: true } });
    return profile?.id ?? null;
  } catch (error) {
    console.error("[analytics] seller lookup failed", error);
    return null;
  }
}

/**
 * For events where the caller knows the seller's user id (quotations), not the profile id. Looks the profile up,
 * then records like trackServer. Never throws.
 */
export async function trackServerForSellerUser(input: {
  kind: EventKind;
  sellerUserId: string;
  gemstoneId?: string | null;
  categoryId?: string | null;
  /** Pass the owner only when the owner's own action must not count (valuations of their own listing). */
  ownerUserId?: string | null;
}): Promise<void> {
  try {
    const sellerId = await sellerProfileIdForUser(input.sellerUserId);
    await trackServer({
      kind: input.kind,
      sellerId,
      gemstoneId: input.gemstoneId ?? null,
      categoryId: input.categoryId ?? null,
      ownerUserId: input.ownerUserId ?? null,
    });
  } catch (error) {
    console.error("[analytics] seller event not recorded", input.kind, error);
  }
}
