"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AuditAction } from "@/lib/audit/actions";
import { recordAudit } from "@/lib/audit/audit";
import { AuthzError } from "@/lib/auth/require-role";
import { prisma } from "@/lib/db/client";
import { getEnv } from "@/lib/config/env";
import { getConversationForParticipant, otherParticipantIds, requireMessagingUser } from "@/lib/messaging/access";
import { MessagingError, markConversationRead, sendMessage, type UploadedFile } from "@/lib/messaging/service";
import { consumeRateLimit } from "@/lib/security/rate-limit";

/**
 * Shared server actions for every conversation thread (buyer, seller and admin-free).
 * The acting user always comes from the session. Client IDs are checked against membership.
 */

export type ActionResult<T extends object = object> = ({ ok: true } & T) | { ok: false; error: string };

const NOT_FOUND = "This conversation is not available.";
const GENERIC = "Something went wrong. Try again.";

const idSchema = z.string().trim().min(1).max(64);

function messageFor(error: unknown): string {
  if (error instanceof MessagingError) return error.message;
  if (error instanceof AuthzError) return "Your account can't do this right now.";
  console.error("[conversations] action failed", error);
  return GENERIC;
}

/**
 * Reads uploads. A file over the limit is not buffered in full: it is passed on as a placeholder one
 * byte over the limit, so validateUpload rejects it with "too large" without holding it in memory.
 */
async function readFiles(formData: FormData): Promise<UploadedFile[]> {
  const out: UploadedFile[] = [];
  const limit = getEnv().UPLOAD_MAX_MB * 1024 * 1024;
  for (const value of formData.getAll("files")) {
    if (typeof value === "string" || value.size === 0) continue;
    if (value.size > limit) {
      out.push({ fileName: value.name, bytes: Buffer.alloc(limit + 1) });
      continue;
    }
    out.push({ fileName: value.name, bytes: Buffer.from(await value.arrayBuffer()) });
  }
  return out;
}

export async function sendMessageAction(
  conversationId: string,
  formData: FormData,
): Promise<ActionResult<{ warning: string | null }>> {
  const parsedId = idSchema.safeParse(conversationId);
  if (!parsedId.success) return { ok: false, error: NOT_FOUND };
  try {
    const user = await requireMessagingUser();
    const body = String(formData.get("body") ?? "");
    const files = await readFiles(formData);
    const result = await sendMessage({ conversationId: parsedId.data, senderId: user.id, body, files });
    revalidatePath("/conversations");
    return { ok: true, warning: result.warning };
  } catch (error) {
    return { ok: false, error: messageFor(error) };
  }
}

export async function markReadAction(conversationId: string): Promise<ActionResult> {
  const parsedId = idSchema.safeParse(conversationId);
  if (!parsedId.success) return { ok: false, error: NOT_FOUND };
  try {
    const user = await requireMessagingUser();
    const updated = await markConversationRead(parsedId.data, user.id);
    return updated ? { ok: true } : { ok: false, error: NOT_FOUND };
  } catch (error) {
    return { ok: false, error: messageFor(error) };
  }
}

/** Blocks the other person in a conversation. Blocked users cannot message the blocker. */
export async function blockConversationAction(conversationId: string): Promise<ActionResult> {
  const parsedId = idSchema.safeParse(conversationId);
  if (!parsedId.success) return { ok: false, error: NOT_FOUND };
  try {
    const user = await requireMessagingUser();
    const conversation = await getConversationForParticipant(parsedId.data, user.id);
    if (!conversation) return { ok: false, error: NOT_FOUND };
    const [targetId] = otherParticipantIds(conversation, user.id);
    if (!targetId) return { ok: false, error: NOT_FOUND };

    await prisma.userBlock.upsert({
      where: { blockerId_blockedId: { blockerId: user.id, blockedId: targetId } },
      create: { blockerId: user.id, blockedId: targetId },
      update: {},
    });
    await recordAudit({
      action: AuditAction.USER_BLOCKED,
      actorId: user.id,
      entityType: "User",
      entityId: targetId,
      meta: { conversationId: parsedId.data },
    });
    revalidatePath(`/conversations/${parsedId.data}`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: messageFor(error) };
  }
}

const reportSchema = z.object({
  reason: z.enum(["SPAM", "SCAM", "HARASSMENT", "FAKE_LISTING", "OTHER"]),
  details: z.string().trim().max(1000).optional(),
  messageId: z.string().trim().max(64).optional(),
});

/** Reports a conversation (optionally one message). Rate limited. Reports go to the admin queue. */
export async function reportConversationAction(conversationId: string, formData: FormData): Promise<ActionResult> {
  const parsedId = idSchema.safeParse(conversationId);
  if (!parsedId.success) return { ok: false, error: NOT_FOUND };
  const parsed = reportSchema.safeParse({
    reason: formData.get("reason"),
    details: formData.get("details") || undefined,
    messageId: formData.get("messageId") || undefined,
  });
  if (!parsed.success) return { ok: false, error: "Choose a reason for the report." };

  try {
    const user = await requireMessagingUser();
    const conversation = await getConversationForParticipant(parsedId.data, user.id);
    if (!conversation) return { ok: false, error: NOT_FOUND };

    const limit = await consumeRateLimit({ key: `report:user:${user.id}`, limit: 5, windowSeconds: 24 * 60 * 60 });
    if (!limit.allowed) return { ok: false, error: "You have filed too many reports today. Try again tomorrow." };

    let messageId: string | null = null;
    if (parsed.data.messageId) {
      const message = await prisma.message.findFirst({
        where: { id: parsed.data.messageId, conversationId: parsedId.data },
        select: { id: true },
      });
      if (!message) return { ok: false, error: NOT_FOUND };
      messageId = message.id;
    }

    const report = await prisma.report.create({
      data: {
        reporterId: user.id,
        conversationId: parsedId.data,
        messageId,
        reason: parsed.data.reason,
        details: parsed.data.details || null,
      },
      select: { id: true },
    });
    await recordAudit({
      action: AuditAction.REPORT_FILED,
      actorId: user.id,
      entityType: "Report",
      entityId: report.id,
      meta: { reason: parsed.data.reason, conversationId: parsedId.data },
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: messageFor(error) };
  }
}
