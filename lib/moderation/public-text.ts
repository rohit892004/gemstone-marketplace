import { AuditAction } from "@/lib/audit/actions";
import { recordAudit } from "@/lib/audit/audit";
import { prisma } from "@/lib/db/client";
import type { ContactKind } from "@/lib/messaging/moderation";
import { NOTIFICATION_TYPES, notify } from "@/lib/notifications/service";
import { PUBLIC_TEXT_WINDOW_MS, shouldAlertAdmins } from "./scan";

/** Sources of refused public-text saves. Kept apart from chat strikes (owner decision: no restriction). */
export const PUBLIC_TEXT_SOURCES = ["PUBLIC_PROFILE", "PUBLIC_LISTING", "PUBLIC_QUOTATION"] as const;
export type PublicTextSource = (typeof PUBLIC_TEXT_SOURCES)[number];

/**
 * Logs a refused save of public seller text. Writes a ModerationFlag (shown in the admin flagged queue,
 * with the listing when there is one) and nothing else on the seller's account: a refused public-text
 * save does NOT count toward the messaging restriction. The text is never stored.
 *
 * The separate counter is the number of PUBLIC_* flags from this seller in the last 24 hours. When it
 * reaches the threshold, every admin gets an alert. At most one alert per seller per window.
 *
 * Never throws for a normal refusal: the caller still refuses the save. A failed log is reported to the
 * server log, because the refusal itself must not depend on the database write.
 */
export async function recordBlockedPublicText(input: {
  senderId: string;
  source: PublicTextSource;
  kinds: ContactKind[];
  /** The listing the text belongs to, when there is one. Checked by the caller for ownership. */
  gemstoneId?: string | null;
  /** Set for quotation text, so the admin can open the conversation. */
  conversationId?: string | null;
  now?: Date;
}): Promise<{ refusalsInWindow: number; alerted: boolean }> {
  const now = input.now ?? new Date();
  const since = new Date(now.getTime() - PUBLIC_TEXT_WINDOW_MS);
  try {
    await prisma.moderationFlag.create({
      data: {
        conversationId: input.conversationId ?? null,
        messageId: null,
        gemstoneId: input.gemstoneId ?? null,
        senderId: input.senderId,
        source: input.source,
        kinds: input.kinds,
        createdAt: now,
      },
    });
    await recordAudit({
      action: AuditAction.MESSAGE_FLAGGED,
      actorId: input.senderId,
      entityType: "User",
      entityId: input.senderId,
      meta: { source: input.source, kinds: input.kinds.join(","), blocked: true },
    });

    const refusalsInWindow = await prisma.moderationFlag.count({
      where: { senderId: input.senderId, source: { in: [...PUBLIC_TEXT_SOURCES] }, createdAt: { gte: since } },
    });
    if (!shouldAlertAdmins(refusalsInWindow)) return { refusalsInWindow, alerted: false };

    const alreadyAlerted = await prisma.auditLog.count({
      where: { action: AuditAction.PUBLIC_TEXT_ALERT, entityId: input.senderId, createdAt: { gte: since } },
    });
    if (alreadyAlerted > 0) return { refusalsInWindow, alerted: false };

    await recordAudit({
      action: AuditAction.PUBLIC_TEXT_ALERT,
      actorId: input.senderId,
      entityType: "User",
      entityId: input.senderId,
      meta: { refusalsInWindow },
    });
    const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
    await Promise.all(
      admins.map((admin) =>
        notify({
          userId: admin.id,
          type: NOTIFICATION_TYPES.ADMIN_ALERT,
          title: "Seller refused public-text saves",
          body: `A seller has had ${refusalsInWindow} public text saves refused in the last 24 hours. Review the flagged queue.`,
          href: "/admin/moderation",
        }),
      ),
    );
    return { refusalsInWindow, alerted: true };
  } catch (error) {
    console.error("[moderation] could not log a refused public text save", error);
    return { refusalsInWindow: 0, alerted: false };
  }
}
