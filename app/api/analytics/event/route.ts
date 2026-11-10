import { z } from "zod";
import { auth } from "@/lib/auth/auth";
import { getEnv } from "@/lib/config/env";
import { prisma } from "@/lib/db/client";
import { CLIENT_EVENT_KINDS } from "@/lib/analytics/events";
import { newVisitorId, recordEvent, validVisitorId, VISITOR_COOKIE, visitorCookie } from "@/lib/analytics/tracking";
import { getClientIp } from "@/lib/security/client-ip";
import { consumeRateLimit } from "@/lib/security/rate-limit";

/**
 * Receives page events from the browser: profile views, listing views, impressions and searches. Other events are
 * recorded on the server by the action that caused them. The body holds ids and a search term only, never a person.
 *
 * Views cannot be inflated: each request is rate limited per client address, targets must be public (an approved
 * seller or a published listing), and a repeat view by the same visitor on the same day is ignored.
 */

const MAX_IMPRESSIONS = 24;

const bodySchema = z.object({
  kind: z.enum(CLIENT_EVENT_KINDS as unknown as [string, ...string[]]),
  sellerSlug: z.string().min(1).max(120).optional(),
  gemstoneId: z.string().min(1).max(60).optional(),
  gemstoneIds: z.array(z.string().min(1).max(60)).max(MAX_IMPRESSIONS).optional(),
  categoryId: z.string().min(1).max(60).optional(),
  term: z.string().max(200).optional(),
});

function cookieValue(request: Request): string | null {
  const header = request.headers.get("cookie") ?? "";
  for (const part of header.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === VISITOR_COOKIE) return rest.join("=");
  }
  return null;
}

export async function POST(request: Request) {
  const limit = await consumeRateLimit({ key: `analytics:ip:${getClientIp(request.headers)}`, limit: 120, windowSeconds: 60 });
  if (!limit.allowed) return new Response(null, { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } });

  let parsed: z.infer<typeof bodySchema>;
  try {
    parsed = bodySchema.parse(await request.json());
  } catch {
    return new Response(null, { status: 400 });
  }

  // The visitor: keep the existing cookie, or start one. The cookie holds a random id, never a person.
  const existing = validVisitorId(cookieValue(request));
  const visitorId = existing ?? newVisitorId();
  const session = await auth();
  const actor = session?.user ? { id: session.user.id, role: session.user.role } : null;
  const userAgent = request.headers.get("user-agent");

  let sellerId: string | null = null;
  let ownerUserId: string | null = null;
  if (parsed.sellerSlug) {
    const seller = await prisma.sellerProfile.findFirst({
      where: { slug: parsed.sellerSlug, approvalStatus: "APPROVED" },
      select: { id: true, userId: true },
    });
    if (seller) {
      sellerId = seller.id;
      ownerUserId = seller.userId;
    }
  }

  const common = { visitorId, actorRole: actor?.role ?? null, actorUserId: actor?.id ?? null, userAgent };

  if (parsed.kind === "PROFILE_VIEW" && sellerId) {
    await recordEvent({ ...common, kind: "PROFILE_VIEW", sellerId, ownerUserId });
  } else if (parsed.kind === "LISTING_VIEW" && parsed.gemstoneId) {
    const listing = await publicListing(parsed.gemstoneId);
    if (listing) await recordEvent({ ...common, kind: "LISTING_VIEW", gemstoneId: listing.id, sellerId: listing.sellerId, categoryId: listing.categoryId, ownerUserId: listing.ownerUserId });
  } else if (parsed.kind === "LISTING_IMPRESSION") {
    const ids = [...new Set([...(parsed.gemstoneId ? [parsed.gemstoneId] : []), ...(parsed.gemstoneIds ?? [])])].slice(0, MAX_IMPRESSIONS);
    for (const id of ids) {
      const listing = await publicListing(id);
      if (listing) await recordEvent({ ...common, kind: "LISTING_IMPRESSION", gemstoneId: listing.id, sellerId: listing.sellerId, categoryId: listing.categoryId, ownerUserId: listing.ownerUserId });
    }
  } else if (parsed.kind === "SEARCH" && parsed.term) {
    await recordEvent({ ...common, kind: "SEARCH", term: parsed.term, categoryId: parsed.categoryId ?? null });
  }

  const headers = new Headers();
  if (!existing) headers.set("Set-Cookie", visitorCookie(visitorId, getEnv().APP_URL.startsWith("https://")));
  return new Response(null, { status: 204, headers });
}

async function publicListing(id: string) {
  const listing = await prisma.gemstone.findFirst({
    where: { id, status: "PUBLISHED", seller: { approvalStatus: "APPROVED" } },
    select: { id: true, sellerId: true, categoryId: true, seller: { select: { userId: true } } },
  });
  if (!listing) return null;
  return { id: listing.id, sellerId: listing.sellerId, categoryId: listing.categoryId, ownerUserId: listing.seller.userId };
}
