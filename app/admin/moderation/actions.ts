"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import type { AdminActionState } from "@/lib/admin/action-state";
import { auditInTransaction, StaleRecordError, transactionFailure, STALE_RECORD_MESSAGE } from "@/lib/admin-moderation/audit";
import { restrictMessaging } from "@/lib/admin-moderation/restrict";
import { checkboxIsOn, flagDecisionSchema } from "@/lib/admin-moderation/schemas";
import { AuditAction } from "@/lib/audit/actions";
import { requireRole } from "@/lib/auth/require-role";
import { prisma } from "@/lib/db/client";
import { getClientIp } from "@/lib/security/client-ip";

/**
 * Flagged-message queue. Each decision:
 *   1. requireRole(["ADMIN"])
 *   2. validates input (the flag id, decision, optional note)
 *   3. in ONE transaction: guarded updateMany (status must still be OPEN), the audit row, and
 *      for "mark actioned" with the restrict box ticked, the 7-day restriction and its audit row.
 * If any write fails, the whole transaction rolls back and the flag stays OPEN.
 *
 * Only masked text is ever read or shown. The detected contact values are never stored.
 */

function formValue(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export async function resolveFlag(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const admin = await requireRole(["ADMIN"]);
  const parsed = flagDecisionSchema.safeParse({
    flagId: formValue(formData, "flagId"),
    decision: formValue(formData, "decision"),
    restrict: checkboxIsOn(formData.get("restrict")),
    note: formValue(formData, "note"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const { flagId, decision, note } = parsed.data;
  // A restriction only follows "mark actioned". Dismissing never restricts anyone.
  const restrict = decision === "ACTION" && parsed.data.restrict;

  const flag = await prisma.moderationFlag.findUnique({
    where: { id: flagId },
    select: { id: true, senderId: true, status: true },
  });
  if (!flag) return { ok: false, error: "This flag no longer exists." };
  if (flag.status !== "OPEN") return { ok: false, error: STALE_RECORD_MESSAGE };

  const status = decision === "DISMISS" ? "DISMISSED" : "ACTIONED";
  const ip = getClientIp(await headers());
  const now = new Date();

  try {
    await prisma.$transaction(async (tx) => {
      const updated = await tx.moderationFlag.updateMany({
        where: { id: flagId, status: "OPEN" },
        data: { status, resolvedById: admin.id, resolvedAt: now },
      });
      if (updated.count === 0) throw new StaleRecordError();

      await auditInTransaction(tx, {
        action: AuditAction.FLAG_RESOLVED,
        actorId: admin.id,
        entityType: "ModerationFlag",
        entityId: flagId,
        ip,
        meta: { decision: status, restricted: restrict, ...(note ? { note } : {}) },
      });

      if (restrict) {
        await restrictMessaging(tx, {
          userId: flag.senderId,
          actorId: admin.id,
          ip,
          now,
          meta: { flagId, reason: "flagged_message" },
        });
      }
    });
  } catch (error) {
    return transactionFailure(error, "flag resolution");
  }

  revalidatePath("/admin/moderation");
  return {
    ok: true,
    message: restrict
      ? "Marked as actioned. The sender cannot send messages for 7 days."
      : status === "ACTIONED"
        ? "Marked as actioned."
        : "Dismissed. No action taken.",
  };
}
