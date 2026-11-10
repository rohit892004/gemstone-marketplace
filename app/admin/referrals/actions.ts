"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { AdminActionState } from "@/lib/admin/action-state";
import { requireRole } from "@/lib/auth/require-role";
import { clearReferralFlag, MembershipError, voidReferral } from "@/lib/membership/service";

/** Admin referral actions: clear a fraud flag after review, or void a referral with a reason. Audited by the service. */

const idSchema = z.string().min(1).max(64);

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function clearReferralFlagAction(_previous: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const admin = await requireRole(["ADMIN"]);
  const referralId = idSchema.safeParse(text(formData, "referralId"));
  if (!referralId.success) return { ok: false, error: "Referral not found." };
  try {
    await clearReferralFlag({ adminId: admin.id, adminRole: admin.role, referralId: referralId.data });
  } catch (error) {
    if (error instanceof MembershipError) return { ok: false, error: error.message };
    throw error;
  }
  revalidatePath("/admin/referrals");
  return { ok: true, message: "Flag cleared. The referral can qualify at the next review." };
}

export async function voidReferralAction(_previous: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const admin = await requireRole(["ADMIN"]);
  const referralId = idSchema.safeParse(text(formData, "referralId"));
  if (!referralId.success) return { ok: false, error: "Referral not found." };
  const reason = text(formData, "reason").trim();
  if (reason.length < 5) return { ok: false, error: "Give a reason of at least 5 characters." };
  if (reason.length > 500) return { ok: false, error: "Use at most 500 characters." };
  try {
    await voidReferral({ adminId: admin.id, adminRole: admin.role, referralId: referralId.data, reason });
  } catch (error) {
    if (error instanceof MembershipError) return { ok: false, error: error.message };
    throw error;
  }
  revalidatePath("/admin/referrals");
  return { ok: true, message: "Referral voided. It no longer counts toward membership." };
}
