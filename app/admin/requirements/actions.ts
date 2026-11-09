"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import type { AdminActionState } from "@/lib/admin/action-state";
import { auditInTransaction, StaleRecordError, transactionFailure } from "@/lib/admin-moderation/audit";
import { requirementCloseSchema } from "@/lib/admin-moderation/schemas";
import { AuditAction } from "@/lib/audit/actions";
import { requireRole } from "@/lib/auth/require-role";
import { prisma } from "@/lib/db/client";
import { getClientIp } from "@/lib/security/client-ip";

/**
 * Requirements moderation. Closing a requirement sets status CLOSED (sellers can no longer respond)
 * and requires a reason of 10 to 500 characters, kept in the audit row. The status change and the
 * audit row commit together.
 */

function formValue(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export async function closeRequirement(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const admin = await requireRole(["ADMIN"]);
  const parsed = requirementCloseSchema.safeParse({
    requirementId: formValue(formData, "requirementId"),
    reason: formValue(formData, "reason"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const { requirementId, reason } = parsed.data;
  const requirement = await prisma.requirement.findUnique({
    where: { id: requirementId },
    select: { id: true, status: true },
  });
  if (!requirement) return { ok: false, error: "This requirement no longer exists." };
  if (requirement.status !== "OPEN") return { ok: false, error: "This requirement is already closed." };

  const ip = getClientIp(await headers());
  try {
    await prisma.$transaction(async (tx) => {
      const updated = await tx.requirement.updateMany({
        where: { id: requirementId, status: "OPEN" },
        data: { status: "CLOSED" },
      });
      if (updated.count === 0) throw new StaleRecordError();

      await auditInTransaction(tx, {
        action: AuditAction.REQUIREMENT_CLOSED,
        actorId: admin.id,
        entityType: "Requirement",
        entityId: requirementId,
        ip,
        meta: { reason },
      });
    });
  } catch (error) {
    return transactionFailure(error, "requirement close");
  }

  revalidatePath("/admin/requirements");
  return { ok: true, message: "Requirement closed. Sellers can no longer respond to it." };
}
