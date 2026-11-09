import type { Prisma } from "@/app/generated/prisma/client";
import { AuditAction } from "@/lib/audit/actions";
import { requireRole, type CurrentUser } from "@/lib/auth/require-role";
import { prisma } from "@/lib/db/client";

/**
 * Conversation access. The rules every messaging read and write goes through:
 *
 *  - Only participants can read a conversation, its messages, attachments, offers or quotations.
 *  - A conversation the caller is not in looks exactly like one that does not exist (null).
 *    Callers must treat null as "not found". Never reveal that the record exists.
 *  - Admins see a conversation only through viewConversationAsAdmin(), which needs a written
 *    reason and writes the audit row first. If the audit row cannot be written, the view is refused.
 *
 * Every ID that comes from the client is checked here, including message, attachment, offer and
 * quotation IDs. Those are resolved through their conversation, then the caller's membership is checked.
 */

export const MESSAGING_ROLES = ["BUYER", "SELLER"] as const;

/** Buyers, and sellers who are approved. Pending or rejected sellers cannot message. */
export function requireMessagingUser(): Promise<CurrentUser> {
  return requireRole(MESSAGING_ROLES, { sellerApproved: true });
}

const participantUserSelect = {
  id: true,
  name: true,
  role: true,
  sellerProfile: { select: { businessName: true, slug: true, approvalStatus: true } },
} satisfies Prisma.UserSelect;

/** Returns the conversation only when `userId` is a participant. Otherwise null. */
export async function getConversationForParticipant(conversationId: string, userId: string) {
  return prisma.conversation.findFirst({
    where: { id: conversationId, participants: { some: { userId } } },
    include: {
      participants: {
        select: { userId: true, lastReadAt: true, user: { select: participantUserSelect } },
      },
      gemstone: { select: { id: true, title: true, slug: true, status: true, availability: true } },
      requirement: { select: { id: true, gemstoneType: true, status: true, buyerId: true } },
    },
  });
}

export type ParticipantConversation = NonNullable<Awaited<ReturnType<typeof getConversationForParticipant>>>;

/** The other party in a two-person conversation, relative to `userId`. */
export function otherParticipantIds(conversation: { participants: { userId: string }[] }, userId: string): string[] {
  return conversation.participants.map((p) => p.userId).filter((id) => id !== userId);
}

/** True when either user has blocked the other. Checked in both directions. */
export async function isBlockedEitherWay(a: string, b: string): Promise<boolean> {
  const row = await prisma.userBlock.findFirst({
    where: {
      OR: [
        { blockerId: a, blockedId: b },
        { blockerId: b, blockedId: a },
      ],
    },
    select: { blockerId: true },
  });
  return row !== null;
}

export interface AdminConversationView {
  conversation: NonNullable<Awaited<ReturnType<typeof loadAdminConversation>>>;
  reason: string;
}

async function loadAdminConversation(conversationId: string) {
  return prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      participants: { select: { userId: true, user: { select: participantUserSelect } } },
      gemstone: { select: { id: true, title: true, slug: true, status: true } },
      requirement: { select: { id: true, gemstoneType: true, status: true } },
      messages: {
        orderBy: { createdAt: "asc" },
        take: 200,
        select: {
          id: true,
          kind: true,
          body: true,
          flagged: true,
          createdAt: true,
          senderId: true,
          attachments: { select: { id: true, fileName: true, mimeType: true, sizeBytes: true } },
        },
      },
      reports: {
        select: { id: true, reason: true, status: true, details: true, createdAt: true, reporterId: true },
      },
    },
  });
}

/**
 * Admin read of a private conversation. Requires ADMIN, a reason of at least 10 characters,
 * and a written audit row. The audit row is written first, and the view is refused if it fails.
 */
export async function viewConversationAsAdmin(
  conversationId: string,
  reason: string,
  ip?: string | null,
): Promise<AdminConversationView | { ok: false; error: "NOT_FOUND" | "REASON_REQUIRED" | "AUDIT_FAILED" }> {
  const admin = await requireRole(["ADMIN"]);
  const trimmed = reason.trim();
  if (trimmed.length < 10 || trimmed.length > 500) return { ok: false, error: "REASON_REQUIRED" };

  const conversation = await loadAdminConversation(conversationId);
  if (!conversation) return { ok: false, error: "NOT_FOUND" };

  try {
    await prisma.auditLog.create({
      data: {
        action: AuditAction.CONVERSATION_ADMIN_VIEWED,
        actorId: admin.id,
        entityType: "Conversation",
        entityId: conversationId,
        ip: ip ?? null,
        meta: { reason: trimmed.slice(0, 500) },
      },
    });
  } catch (error) {
    console.error("[audit] admin conversation view refused: audit write failed", error);
    return { ok: false, error: "AUDIT_FAILED" };
  }

  return { conversation, reason: trimmed };
}
