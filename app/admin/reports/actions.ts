"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import type { AdminActionState } from "@/lib/admin/action-state";
import { auditInTransaction, StaleRecordError, transactionFailure, STALE_RECORD_MESSAGE } from "@/lib/admin-moderation/audit";
import { pickReportedUserId } from "@/lib/admin-moderation/reported-user";
import { restrictMessaging } from "@/lib/admin-moderation/restrict";
import { checkboxIsOn, reportDecisionSchema } from "@/lib/admin-moderation/schemas";
import { AuditAction } from "@/lib/audit/actions";
import { requireRole } from "@/lib/auth/require-role";
import { prisma } from "@/lib/db/client";
import { getClientIp } from "@/lib/security/client-ip";

/**
 * Report queue. Resolve or dismiss a report with a resolution note (10 to 500 characters).
 * "Resolve" can also restrict messaging for the reported user for 7 days. The restricted user is
 * the sender of the reported message, or the single other participant of the conversation. If
 * there is no single target, the restriction is refused and nothing changes.
 *
 * The status change, the resolution note, the audit rows and any restriction commit together.
 */

function formValue(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export async function resolveReport(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const admin = await requireRole(["ADMIN"]);
  const parsed = reportDecisionSchema.safeParse({
    reportId: formValue(formData, "reportId"),
    decision: formValue(formData, "decision"),
    restrict: checkboxIsOn(formData.get("restrict")),
    note: formValue(formData, "note"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const { reportId, decision, note } = parsed.data;
  const restrict = decision === "RESOLVE" && parsed.data.restrict;

  const report = await prisma.report.findUnique({
    where: { id: reportId },
    select: { id: true, status: true, reporterId: true, conversationId: true, messageId: true },
  });
  if (!report) return { ok: false, error: "This report no longer exists." };
  if (report.status !== "OPEN") return { ok: false, error: STALE_RECORD_MESSAGE };

  let reportedUserId: string | null = null;
  if (restrict) {
    if (!report.conversationId) {
      return { ok: false, error: "Only a report about a conversation can restrict a user. Resolve it without a restriction." };
    }
    const [participants, message] = await Promise.all([
      prisma.conversationParticipant.findMany({
        where: { conversationId: report.conversationId },
        select: { userId: true },
      }),
      report.messageId
        ? prisma.message.findFirst({
            where: { id: report.messageId, conversationId: report.conversationId },
            select: { senderId: true },
          })
        : null,
    ]);
    reportedUserId = pickReportedUserId({
      reporterId: report.reporterId,
      participantIds: participants.map((p) => p.userId),
      messageSenderId: message?.senderId ?? null,
    });
    if (!reportedUserId) {
      return {
        ok: false,
        error: "There is no single user to restrict in this report. Resolve it without a restriction.",
      };
    }
  }

  const status = decision === "RESOLVE" ? "RESOLVED" : "DISMISSED";
  const ip = getClientIp(await headers());
  const now = new Date();

  try {
    await prisma.$transaction(async (tx) => {
      const updated = await tx.report.updateMany({
        where: { id: reportId, status: "OPEN" },
        data: { status, resolvedById: admin.id, resolvedAt: now, resolutionNote: note },
      });
      if (updated.count === 0) throw new StaleRecordError();

      await auditInTransaction(tx, {
        action: AuditAction.REPORT_RESOLVED,
        actorId: admin.id,
        entityType: "Report",
        entityId: reportId,
        ip,
        meta: { decision: status, restricted: reportedUserId !== null },
      });

      if (reportedUserId) {
        await restrictMessaging(tx, {
          userId: reportedUserId,
          actorId: admin.id,
          ip,
          now,
          meta: { reportId, reason: "reported_conversation" },
        });
      }
    });
  } catch (error) {
    return transactionFailure(error, "report resolution");
  }

  revalidatePath("/admin/reports");
  return {
    ok: true,
    message: reportedUserId
      ? "Report resolved. The reported user cannot send messages for 7 days."
      : status === "RESOLVED"
        ? "Report resolved."
        : "Report dismissed.",
  };
}
