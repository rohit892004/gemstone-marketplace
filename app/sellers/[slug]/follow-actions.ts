"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";
import { recordEvent, VISITOR_COOKIE, validVisitorId } from "@/lib/analytics/tracking";
import { AuditAction } from "@/lib/audit/actions";
import { recordAudit } from "@/lib/audit/audit";
import { checkRole } from "@/lib/auth/require-role";
import { prisma } from "@/lib/db/client";
import { decideFollow, followRefusalMessage, type FollowRefusal } from "@/lib/membership/follow";

/**
 * Follow and unfollow a seller. Buyers and sellers only, never their own business, approved sellers only for a new
 * follow. A new follow is recorded as a FOLLOW analytics event (no event on unfollow). Audited either way.
 */

export interface FollowState {
  ok?: boolean;
  following?: boolean;
  error?: string;
}

const slugSchema = z.string().min(1).max(200);

function refusalState(reason: FollowRefusal): FollowState {
  return { ok: false, error: followRefusalMessage(reason) };
}

export async function toggleFollowAction(_previous: FollowState, formData: FormData): Promise<FollowState> {
  const parsedSlug = slugSchema.safeParse(formData.get("sellerSlug"));
  if (!parsedSlug.success) return { ok: false, error: "This seller could not be found." };
  const slug = parsedSlug.data;

  const viewer = await checkRole(["BUYER", "SELLER"]);
  if (!viewer.ok) {
    if (viewer.code === "UNAUTHENTICATED" || viewer.code === "EMAIL_NOT_VERIFIED") return refusalState("signed-out");
    if (viewer.code === "FORBIDDEN") return refusalState("role");
    return { ok: false, error: "Your account cannot follow sellers right now." };
  }

  const seller = await prisma.sellerProfile.findUnique({
    where: { slug },
    select: { id: true, userId: true, approvalStatus: true },
  });
  if (!seller) return { ok: false, error: "This seller could not be found." };

  const existing = await prisma.follow.findUnique({
    where: { followerId_sellerId: { followerId: viewer.user.id, sellerId: seller.id } },
    select: { id: true },
  });

  const decision = decideFollow({
    actorRole: viewer.user.role,
    actorUserId: viewer.user.id,
    sellerUserId: seller.userId,
    sellerApproval: seller.approvalStatus,
    currentlyFollowing: Boolean(existing),
  });
  if (!decision.allowed) return refusalState(decision.reason);

  if (decision.action === "unfollow") {
    await prisma.follow.deleteMany({ where: { followerId: viewer.user.id, sellerId: seller.id } });
    await recordAudit({
      action: AuditAction.FOLLOW_CHANGED,
      actorId: viewer.user.id,
      entityType: "SellerProfile",
      entityId: seller.id,
      meta: { change: "unfollow" },
    });
    revalidatePath(`/sellers/${slug}`);
    return { ok: true, following: false };
  }

  try {
    await prisma.follow.create({ data: { followerId: viewer.user.id, sellerId: seller.id } });
  } catch (error) {
    // A double submit: the row already exists, so the viewer is following. Nothing more to do.
    if (!(typeof error === "object" && error !== null && (error as { code?: string }).code === "P2002")) throw error;
    revalidatePath(`/sellers/${slug}`);
    return { ok: true, following: true };
  }

  await recordAudit({
    action: AuditAction.FOLLOW_CHANGED,
    actorId: viewer.user.id,
    entityType: "SellerProfile",
    entityId: seller.id,
    meta: { change: "follow" },
  });

  // The analytics event is best-effort: a tracking failure never blocks the follow.
  try {
    const visitorId = validVisitorId((await cookies()).get(VISITOR_COOKIE)?.value);
    await recordEvent({
      kind: "FOLLOW",
      visitorId,
      sellerId: seller.id,
      actorRole: viewer.user.role,
      actorUserId: viewer.user.id,
      ownerUserId: seller.userId,
    });
  } catch (error) {
    console.error("[membership] follow event failed", error);
  }

  revalidatePath(`/sellers/${slug}`);
  return { ok: true, following: true };
}
