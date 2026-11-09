"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import type { ApprovalStatus, Prisma } from "@/app/generated/prisma/client";
import type { AdminActionState } from "@/lib/admin/action-state";
import { requireRole } from "@/lib/auth/require-role";
import { appUrl } from "@/lib/config/app-url";
import { AuditAction, type AuditActionName } from "@/lib/audit/actions";
import { recordAudit } from "@/lib/audit/audit";
import { prisma } from "@/lib/db/client";
import { getEmailProvider } from "@/lib/notify/email";
import { emailTemplates, type Rendered } from "@/lib/notify/templates";
import { getClientIp } from "@/lib/security/client-ip";
import { rejectSellerSchema, sellerIdSchema } from "@/lib/validation/schemas";

/**
 * Seller moderation. Every action:
 *   1. requireRole(["ADMIN"]) (throws AuthzError for anyone else)
 *   2. validates input
 *   3. applies the change with updateMany guarded by the expected current status,
 *      so two admins (or a double click) cannot both win a race
 *   4. writes the audit entry, then sends the email
 * An email failure is logged and does not undo the decision.
 *
 * Actions take (prevState, formData) so forms can use useActionState.
 */

const STALE_STATUS_ERROR = "This seller's status changed while you were working. Reload the page and try again.";

interface Decision {
  action: AuditActionName;
  /** The decision only applies when the seller is currently in one of these states. */
  allowedFrom: ApprovalStatus[];
  /** Unchecked input, because approvedById is a scalar foreign key. */
  data: Prisma.SellerProfileUncheckedUpdateManyInput;
  message: string;
  meta?: Record<string, string>;
  email: (recipientName: string) => Rendered;
}

async function applyDecision(sellerId: string, adminId: string, decision: Decision): Promise<AdminActionState> {
  const seller = await prisma.sellerProfile.findUnique({
    where: { id: sellerId },
    select: { businessName: true, user: { select: { email: true, name: true } } },
  });
  if (!seller) return { ok: false, error: "Seller not found." };

  const result = await prisma.sellerProfile.updateMany({
    where: { id: sellerId, approvalStatus: { in: decision.allowedFrom } },
    data: decision.data,
  });
  if (result.count === 0) return { ok: false, error: STALE_STATUS_ERROR };

  const ip = getClientIp(await headers());
  await recordAudit({
    action: decision.action,
    actorId: adminId,
    entityType: "SellerProfile",
    entityId: sellerId,
    ip,
    meta: decision.meta,
  });

  try {
    const mail = decision.email(seller.user.name ?? seller.businessName);
    await getEmailProvider().send({ to: seller.user.email, subject: mail.subject, text: mail.text });
  } catch (error) {
    console.error("[admin] decision email failed", decision.action, sellerId, error);
  }

  revalidatePath("/admin/sellers");
  revalidatePath(`/admin/sellers/${sellerId}`);
  return { ok: true, message: decision.message };
}

function formValue(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export async function approveSeller(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const admin = await requireRole(["ADMIN"]);
  const parsed = sellerIdSchema.safeParse({ sellerId: formValue(formData, "sellerId") });
  if (!parsed.success) return { ok: false, error: "Invalid seller." };

  const now = new Date();
  return applyDecision(parsed.data.sellerId, admin.id, {
    action: AuditAction.SELLER_APPROVED,
    allowedFrom: ["PENDING", "REJECTED"],
    data: {
      approvalStatus: "APPROVED",
      approvedById: admin.id,
      approvedAt: now,
      reviewedAt: now,
      // Clear any earlier rejection reason once the seller is approved.
      rejectionReason: null,
    },
    message: "Seller approved. They have been emailed.",
    email: (name) => emailTemplates.sellerApproved(name, appUrl("/login")),
  });
}

export async function rejectSeller(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const admin = await requireRole(["ADMIN"]);
  const parsed = rejectSellerSchema.safeParse({
    sellerId: formValue(formData, "sellerId"),
    reason: formValue(formData, "reason"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const { sellerId, reason } = parsed.data;
  return applyDecision(sellerId, admin.id, {
    action: AuditAction.SELLER_REJECTED,
    allowedFrom: ["PENDING"],
    data: { approvalStatus: "REJECTED", rejectionReason: reason, reviewedAt: new Date() },
    message: "Application rejected. The seller has been emailed the reason.",
    email: (name) => emailTemplates.sellerRejected(name, reason),
  });
}

export async function suspendSeller(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const admin = await requireRole(["ADMIN"]);
  const parsed = rejectSellerSchema.safeParse({
    sellerId: formValue(formData, "sellerId"),
    reason: formValue(formData, "reason"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const { sellerId, reason } = parsed.data;
  return applyDecision(sellerId, admin.id, {
    action: AuditAction.SELLER_SUSPENDED,
    allowedFrom: ["APPROVED"],
    // Suspension reason is kept in the audit entry and the email; rejectionReason is only for rejections.
    data: { approvalStatus: "SUSPENDED", reviewedAt: new Date() },
    meta: { reason },
    message: "Seller suspended. They have been emailed the reason.",
    email: (name) => emailTemplates.sellerSuspended(name, reason),
  });
}

export async function reactivateSeller(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const admin = await requireRole(["ADMIN"]);
  const parsed = sellerIdSchema.safeParse({ sellerId: formValue(formData, "sellerId") });
  if (!parsed.success) return { ok: false, error: "Invalid seller." };

  return applyDecision(parsed.data.sellerId, admin.id, {
    action: AuditAction.SELLER_REACTIVATED,
    allowedFrom: ["SUSPENDED"],
    data: { approvalStatus: "APPROVED", reviewedAt: new Date() },
    message: "Seller reactivated. They have been emailed.",
    // Reactivation restores the approved state, so the approval email is the right message.
    email: (name) => emailTemplates.sellerApproved(name, appUrl("/login")),
  });
}
