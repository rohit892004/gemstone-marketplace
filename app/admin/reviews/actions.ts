"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { CATALOGUE_AUDIT, recordCatalogueAudit } from "@/lib/admin-catalogue/audit";
import { computeSellerRating } from "@/lib/admin-catalogue/rating";
import { reviewDecisionSchema, reviewRejectSchema } from "@/lib/admin-catalogue/schemas";
import type { AdminActionState } from "@/lib/admin/action-state";
import { requireRole } from "@/lib/auth/require-role";
import { prisma } from "@/lib/db/client";
import { getClientIp } from "@/lib/security/client-ip";

/**
 * Review moderation. The status change and the seller's cached rating are written in ONE transaction:
 * the rating is recomputed from APPROVED reviews only.
 */

const STALE_REVIEW_ERROR = "This review was already decided. Reload the page and try again.";

class StaleReviewError extends Error {}

function formValue(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

async function decideReview(
  reviewId: string,
  adminId: string,
  status: "APPROVED" | "REJECTED",
  reason: string | null,
): Promise<AdminActionState> {
  const review = await prisma.review.findUnique({ where: { id: reviewId }, select: { id: true, sellerId: true } });
  if (!review) return { ok: false, error: "Review not found." };

  try {
    await prisma.$transaction(async (tx) => {
      const result = await tx.review.updateMany({
        where: { id: reviewId, status: "PENDING" },
        data: { status, moderatedById: adminId, moderatedAt: new Date(), rejectionReason: reason },
      });
      if (result.count === 0) throw new StaleReviewError();

      const approved = await tx.review.findMany({
        where: { sellerId: review.sellerId, status: "APPROVED" },
        select: { rating: true },
      });
      const summary = computeSellerRating(approved.map((r) => r.rating));
      await tx.sellerProfile.update({
        where: { id: review.sellerId },
        data: { ratingAverage: summary.ratingAverage, reviewCount: summary.reviewCount },
      });
    });
  } catch (error) {
    if (error instanceof StaleReviewError) return { ok: false, error: STALE_REVIEW_ERROR };
    throw error;
  }

  await recordCatalogueAudit({
    action: status === "APPROVED" ? CATALOGUE_AUDIT.REVIEW_APPROVED : CATALOGUE_AUDIT.REVIEW_REJECTED,
    actorId: adminId,
    entityType: "Review",
    entityId: reviewId,
    ip: getClientIp(await headers()),
    meta: { sellerId: review.sellerId },
  });

  revalidatePath("/admin/reviews");
  return {
    ok: true,
    message: status === "APPROVED" ? "Review approved. Seller rating updated." : "Review rejected. Seller rating updated.",
  };
}

export async function approveReview(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const admin = await requireRole(["ADMIN"]);
  const parsed = reviewDecisionSchema.safeParse({ reviewId: formValue(formData, "reviewId") });
  if (!parsed.success) return { ok: false, error: "Invalid review." };
  return decideReview(parsed.data.reviewId, admin.id, "APPROVED", null);
}

export async function rejectReview(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const admin = await requireRole(["ADMIN"]);
  const parsed = reviewRejectSchema.safeParse({
    reviewId: formValue(formData, "reviewId"),
    reason: formValue(formData, "reason"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid review." };
  return decideReview(parsed.data.reviewId, admin.id, "REJECTED", parsed.data.reason);
}
