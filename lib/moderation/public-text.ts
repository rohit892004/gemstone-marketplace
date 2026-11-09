import { AuditAction } from "@/lib/audit/actions";
import { recordAudit } from "@/lib/audit/audit";
import { recordContactFlag } from "@/lib/commerce/strikes";
import { prisma } from "@/lib/db/client";
import type { ContactKind } from "@/lib/messaging/moderation";

/**
 * Logs a refused save of public seller text. Writes a ModerationFlag (so it shows in the admin flagged
 * queue) and applies the same strike policy as chat: the first attempt is a warning, a second starts a
 * temporary messaging restriction. The text itself is never stored.
 *
 * Never throws for a normal refusal: the caller still refuses the save. A failed log is reported to the
 * server log, because the refusal itself must not depend on the database write.
 */
export async function recordBlockedPublicText(input: {
  senderId: string;
  source: "PUBLIC_PROFILE" | "PUBLIC_LISTING" | "QUOTATION";
  kinds: ContactKind[];
  /** Set for quotation terms, so the admin can open the conversation. */
  conversationId?: string | null;
  now?: Date;
}): Promise<{ strikes: number; restrictedUntil: Date | null }> {
  const now = input.now ?? new Date();
  try {
    const result = await prisma.$transaction((tx) =>
      recordContactFlag(tx, {
        conversationId: input.conversationId ?? null,
        messageId: null,
        senderId: input.senderId,
        source: input.source,
        kinds: input.kinds,
        now,
      }),
    );
    await recordAudit({
      action: AuditAction.MESSAGE_FLAGGED,
      actorId: input.senderId,
      entityType: "User",
      entityId: input.senderId,
      meta: { source: input.source, kinds: input.kinds.join(","), strikes: result.strikes, blocked: true },
    });
    if (result.restrictedUntil) {
      await recordAudit({
        action: AuditAction.MESSAGING_RESTRICTED,
        actorId: input.senderId,
        entityType: "User",
        entityId: input.senderId,
        meta: { until: result.restrictedUntil.toISOString(), strikes: result.strikes },
      });
    }
    return result;
  } catch (error) {
    console.error("[moderation] could not log a blocked public text save", error);
    return { strikes: 0, restrictedUntil: null };
  }
}
