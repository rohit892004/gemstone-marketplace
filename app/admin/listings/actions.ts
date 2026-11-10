"use server";

import { assertCanPublishListing, MembershipError } from "@/lib/membership/service";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { catalogueTemplates } from "@/lib/admin-catalogue/templates";
import { CATALOGUE_AUDIT, recordCatalogueAudit } from "@/lib/admin-catalogue/audit";
import { featuredToggleSchema, listingIdSchema, listingRejectSchema } from "@/lib/admin-catalogue/schemas";
import type { AdminActionState } from "@/lib/admin/action-state";
import { requireRole } from "@/lib/auth/require-role";
import { appUrl } from "@/lib/config/app-url";
import { prisma } from "@/lib/db/client";
import { getEmailProvider } from "@/lib/notify/email";
import { getClientIp } from "@/lib/security/client-ip";
import { notifyFollowersOfNewListing } from "@/lib/membership/notify-followers";

/**
 * Listing moderation. Every action: requireRole(["ADMIN"]) first, validate, one updateMany guarded
 * by the expected current status (a stale click returns a friendly error), audit, then email.
 * An email failure is logged and does not undo the decision.
 */

const STALE_LISTING_ERROR = "This listing changed while you were working. Reload the page and try again.";

function formValue(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

async function sellerContact(listingId: string) {
  return prisma.gemstone.findUnique({
    where: { id: listingId },
    select: {
      id: true,
      title: true,
      slug: true,
      seller: { select: { businessName: true, user: { select: { email: true, name: true } } } },
    },
  });
}

export async function approveListing(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const admin = await requireRole(["ADMIN"]);
  const parsed = listingIdSchema.safeParse({ listingId: formValue(formData, "listingId") });
  if (!parsed.success) return { ok: false, error: "Invalid listing." };
  const { listingId } = parsed.data;

  const listing = await sellerContact(listingId);
  if (!listing) return { ok: false, error: "Listing not found." };

  // The seller's membership limit applies to every publish, including an admin approval.
  const target = await prisma.gemstone.findUnique({ where: { id: listingId }, select: { sellerId: true } });
  if (!target) return { ok: false, error: "Listing not found." };
  try {
    await assertCanPublishListing(target.sellerId);
  } catch (error) {
    if (error instanceof MembershipError) {
      return { ok: false, error: "The seller is at the active listing limit for their membership. Ask them to archive a listing, or change their membership tier." };
    }
    throw error;
  }

  const now = new Date();
  const result = await prisma.gemstone.updateMany({
    where: { id: listingId, status: "PENDING_REVIEW" },
    data: { status: "PUBLISHED", publishedAt: now, reviewedAt: now, reviewedById: admin.id, rejectionReason: null },
  });
  if (result.count === 0) return { ok: false, error: STALE_LISTING_ERROR };

  // Followers hear about the listing only now that it is published (the transition, not a later edit).
  const followed = await prisma.gemstone.findUnique({ where: { id: listingId }, select: { sellerId: true, slug: true } });
  if (followed) await notifyFollowersOfNewListing({ sellerId: followed.sellerId, listingSlug: followed.slug });

  await recordCatalogueAudit({
    action: CATALOGUE_AUDIT.LISTING_APPROVED,
    actorId: admin.id,
    entityType: "Gemstone",
    entityId: listingId,
    ip: getClientIp(await headers()),
  });

  try {
    const mail = catalogueTemplates.listingApproved(
      listing.seller.user.name ?? listing.seller.businessName,
      listing.title,
      appUrl(`/gemstones/${listing.slug}`),
    );
    await getEmailProvider().send({ to: listing.seller.user.email, subject: mail.subject, text: mail.text });
  } catch (error) {
    console.error("[admin] listing approval email failed", listingId, error);
  }

  revalidatePath("/admin/listings");
  revalidatePath(`/admin/listings/${listingId}`);
  return { ok: true, message: "Listing published. The seller has been emailed." };
}

export async function rejectListing(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const admin = await requireRole(["ADMIN"]);
  const parsed = listingRejectSchema.safeParse({
    listingId: formValue(formData, "listingId"),
    reason: formValue(formData, "reason"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const { listingId, reason } = parsed.data;

  const listing = await sellerContact(listingId);
  if (!listing) return { ok: false, error: "Listing not found." };

  const result = await prisma.gemstone.updateMany({
    where: { id: listingId, status: "PENDING_REVIEW" },
    data: { status: "REJECTED", rejectionReason: reason, reviewedAt: new Date(), reviewedById: admin.id },
  });
  if (result.count === 0) return { ok: false, error: STALE_LISTING_ERROR };

  await recordCatalogueAudit({
    action: CATALOGUE_AUDIT.LISTING_REJECTED,
    actorId: admin.id,
    entityType: "Gemstone",
    entityId: listingId,
    ip: getClientIp(await headers()),
  });

  try {
    const mail = catalogueTemplates.listingRejected(
      listing.seller.user.name ?? listing.seller.businessName,
      listing.title,
      reason,
    );
    await getEmailProvider().send({ to: listing.seller.user.email, subject: mail.subject, text: mail.text });
  } catch (error) {
    console.error("[admin] listing rejection email failed", listingId, error);
  }

  revalidatePath("/admin/listings");
  revalidatePath(`/admin/listings/${listingId}`);
  return { ok: true, message: "Listing rejected. The seller has been emailed the reason." };
}

/** Toggles the featured flag. Only public listings are shown in the homepage carousel. */
export async function setListingFeatured(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const admin = await requireRole(["ADMIN"]);
  const parsed = featuredToggleSchema.safeParse({
    listingId: formValue(formData, "listingId"),
    featured: formValue(formData, "featured"),
  });
  if (!parsed.success) return { ok: false, error: "Invalid input." };
  const { listingId, featured } = parsed.data;

  // Only the current value is the precondition: a double click cannot apply the same toggle twice.
  const result = await prisma.gemstone.updateMany({
    where: { id: listingId, featured: !featured },
    data: { featured },
  });
  if (result.count === 0) return { ok: false, error: STALE_LISTING_ERROR };

  await recordCatalogueAudit({
    action: CATALOGUE_AUDIT.LISTING_FEATURED_CHANGED,
    actorId: admin.id,
    entityType: "Gemstone",
    entityId: listingId,
    ip: getClientIp(await headers()),
    meta: { featured },
  });

  revalidatePath("/admin/listings/all");
  revalidatePath("/");
  return { ok: true, message: featured ? "Listing featured." : "Listing removed from featured." };
}
