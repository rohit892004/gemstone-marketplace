import { randomUUID } from "node:crypto";
import { Prisma, type ConversationKind, type MessageKind } from "@/app/generated/prisma/client";
import { AuditAction } from "@/lib/audit/actions";
import { recordAudit } from "@/lib/audit/audit";
import { prisma } from "@/lib/db/client";
import { publicListingWhere } from "@/lib/listings/visibility";
import { NOTIFICATION_TYPES, notify } from "@/lib/notifications/service";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import { sanitizeFileName } from "@/lib/seller/sanitize-filename";
import { getStorageProvider } from "@/lib/storage/storage";
import { uploadErrorMessage, validateUpload } from "@/lib/storage/upload-validation";
import { isBlockedEitherWay } from "./access";
import { moderateContactDetails } from "./moderation";

/**
 * Messaging service. The only code that creates conversations, messages and attachments.
 * Callers pass a trusted senderId from the server session, never from the client.
 *
 * Each send runs: participant check, restriction, block check, rate limit, contact-detail masking,
 * storage of masked text, strike and restriction update, then notifications. Raw contact details
 * are never written to the database.
 */

export class MessagingError extends Error {
  constructor(
    readonly code:
      | "NOT_FOUND"
      | "NOT_AVAILABLE"
      | "SELF_CONTACT"
      | "BLOCKED"
      | "RESTRICTED"
      | "RATE_LIMITED"
      | "INVALID",
    message: string,
    readonly retryAfterSeconds?: number,
    readonly restrictedUntil?: Date,
  ) {
    super(message);
    this.name = "MessagingError";
  }
}

export const MESSAGE_MAX_CHARS = 2000;
export const MAX_ATTACHMENTS_PER_MESSAGE = 3;
export const CONTACT_WARNING =
  "Contact details are hidden on Gemstone Selections. Keep the conversation on the platform. Sharing them again can restrict your messaging.";
export const RESTRICTION_HOURS = 24;

const RATE = {
  message: { limit: 30, windowSeconds: 10 * 60 },
  enquiry: { limit: 10, windowSeconds: 24 * 60 * 60 },
} as const;

export type UploadedFile = { fileName: string; bytes: Buffer };

export interface SendResult {
  messageId: string;
  /** Set when contact details were masked on this send. Show it to the sender. */
  warning: string | null;
  /** Set when this send caused a messaging restriction. */
  restrictedUntil: Date | null;
}

const participantSelect = {
  userId: true,
  lastReadAt: true,
} as const;

/** Blocks, restrictions and rate limits. Throws MessagingError. */
export async function assertCanMessage(senderId: string, otherUserIds: string[], now = new Date()): Promise<void> {
  const sender = await prisma.user.findUnique({
    where: { id: senderId },
    select: { messagingRestrictedUntil: true },
  });
  if (sender?.messagingRestrictedUntil && sender.messagingRestrictedUntil > now) {
    throw new MessagingError("RESTRICTED", "Messaging is temporarily restricted on your account.", undefined, sender.messagingRestrictedUntil);
  }
  for (const other of otherUserIds) {
    if (await isBlockedEitherWay(senderId, other)) {
      throw new MessagingError("BLOCKED", "You can't message this user.");
    }
  }
}

async function consumeOrThrow(key: string, rule: { limit: number; windowSeconds: number }, message: string) {
  const result = await consumeRateLimit({ key, limit: rule.limit, windowSeconds: rule.windowSeconds });
  if (!result.allowed) {
    throw new MessagingError("RATE_LIMITED", message, result.retryAfterSeconds);
  }
}

/**
 * Finds or creates a conversation for a pairKey. Idempotent and race-safe: a concurrent create
 * hits the unique pairKey and returns the winner's row.
 */
export async function getOrCreateConversation(input: {
  kind: ConversationKind;
  pairKey: string;
  startedById: string;
  participantIds: [string, string];
  gemstoneId?: string | null;
  requirementId?: string | null;
  isDemo?: boolean;
}): Promise<{ conversationId: string; created: boolean }> {
  const existing = await prisma.conversation.findUnique({ where: { pairKey: input.pairKey }, select: { id: true } });
  if (existing) return { conversationId: existing.id, created: false };

  try {
    const created = await prisma.conversation.create({
      data: {
        kind: input.kind,
        pairKey: input.pairKey,
        startedById: input.startedById,
        gemstoneId: input.gemstoneId ?? null,
        requirementId: input.requirementId ?? null,
        isDemo: input.isDemo ?? false,
        participants: {
          create: input.participantIds.map((userId) => ({ userId })),
        },
      },
      select: { id: true },
    });
    return { conversationId: created.id, created: true };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const winner = await prisma.conversation.findUniqueOrThrow({ where: { pairKey: input.pairKey }, select: { id: true } });
      return { conversationId: winner.id, created: false };
    }
    throw error;
  }
}

/** Stores uploaded files privately and returns the rows to insert. Deletes stored objects if the caller fails. */
async function prepareAttachments(conversationId: string, files: UploadedFile[]) {
  if (files.length > MAX_ATTACHMENTS_PER_MESSAGE) {
    throw new MessagingError("INVALID", `You can attach up to ${MAX_ATTACHMENTS_PER_MESSAGE} files.`);
  }
  const prepared: { storageKey: string; fileName: string; mimeType: string; sizeBytes: number }[] = [];
  const storage = getStorageProvider();
  try {
    for (const file of files) {
      const check = validateUpload(file.bytes);
      if (!check.ok) throw new MessagingError("INVALID", uploadErrorMessage(check.reason));
      const storageKey = `messages/${conversationId}/${randomUUID()}.${check.ext}`;
      await storage.put(storageKey, file.bytes);
      // File names are shown to users, so they go through the same contact-detail masking as text.
      const cleanName = sanitizeFileName(file.fileName);
      const fileName = moderateContactDetails(cleanName).flagged ? `attachment.${check.ext}` : cleanName;
      prepared.push({ storageKey, fileName, mimeType: check.mimeType, sizeBytes: check.sizeBytes });
    }
  } catch (error) {
    await Promise.all(prepared.map((p) => storage.delete(p.storageKey).catch(() => undefined)));
    throw error;
  }
  return prepared;
}

export async function sendMessage(input: {
  conversationId: string;
  senderId: string;
  body: string;
  files?: UploadedFile[];
  now?: Date;
}): Promise<SendResult> {
  const now = input.now ?? new Date();
  const files = input.files ?? [];
  const rawBody = input.body.trim();
  if (rawBody.length > MESSAGE_MAX_CHARS) {
    throw new MessagingError("INVALID", `Messages can be ${MESSAGE_MAX_CHARS} characters or fewer.`);
  }
  if (rawBody.length === 0 && files.length === 0) {
    throw new MessagingError("INVALID", "Write a message or attach a file.");
  }

  const conversation = await prisma.conversation.findFirst({
    where: { id: input.conversationId, participants: { some: { userId: input.senderId } } },
    select: { id: true, participants: { select: participantSelect }, requirement: { select: { status: true } } },
  });
  if (!conversation) throw new MessagingError("NOT_FOUND", "Conversation not found.");
  // A closed requirement is read only, on the server as well as in the UI.
  if (conversation.requirement?.status === "CLOSED") {
    throw new MessagingError("NOT_AVAILABLE", "This requirement is closed, so the conversation is read only.");
  }

  const others = conversation.participants.map((p) => p.userId).filter((id) => id !== input.senderId);
  await assertCanMessage(input.senderId, others, now);
  await consumeOrThrow(`msg:user:${input.senderId}`, RATE.message, "You are sending messages too quickly. Try again shortly.");

  const moderation = moderateContactDetails(rawBody);
  const attachments = await prepareAttachments(input.conversationId, files);

  let result: { messageId: string; restrictedUntil: Date | null; strikes: number };
  try {
    result = await prisma.$transaction(async (tx) => {
      const message = await tx.message.create({
        data: {
          conversationId: input.conversationId,
          senderId: input.senderId,
          kind: "TEXT" satisfies MessageKind,
          body: moderation.text,
          flagged: moderation.flagged,
          createdAt: now,
          attachments: { create: attachments },
        },
        select: { id: true },
      });
      await tx.conversation.update({ where: { id: input.conversationId }, data: { lastMessageAt: now } });
      await tx.conversationParticipant.update({
        where: { conversationId_userId: { conversationId: input.conversationId, userId: input.senderId } },
        data: { lastReadAt: now },
      });

      if (!moderation.flagged) return { messageId: message.id, restrictedUntil: null, strikes: 0 };

      await tx.moderationFlag.create({
        data: {
          conversationId: input.conversationId,
          messageId: message.id,
          senderId: input.senderId,
          source: "MESSAGE",
          kinds: moderation.kinds,
        },
      });
      const sender = await tx.user.update({
        where: { id: input.senderId },
        data: { contactStrikes: { increment: 1 } },
        select: { contactStrikes: true },
      });
      // First offence: warning only. A repeat offence starts a temporary restriction.
      let restrictedUntil: Date | null = null;
      if (sender.contactStrikes >= 2) {
        restrictedUntil = new Date(now.getTime() + RESTRICTION_HOURS * 60 * 60 * 1000);
        await tx.user.update({ where: { id: input.senderId }, data: { messagingRestrictedUntil: restrictedUntil } });
      }
      return { messageId: message.id, restrictedUntil, strikes: sender.contactStrikes };
    });
  } catch (error) {
    await Promise.all(attachments.map((a) => getStorageProvider().delete(a.storageKey).catch(() => undefined)));
    throw error;
  }

  await recordAudit({
    action: AuditAction.MESSAGE_SENT,
    actorId: input.senderId,
    entityType: "Message",
    entityId: result.messageId,
    meta: { conversationId: input.conversationId, attachments: attachments.length, flagged: moderation.flagged },
  });
  if (moderation.flagged) {
    await recordAudit({
      action: AuditAction.MESSAGE_FLAGGED,
      actorId: input.senderId,
      entityType: "Message",
      entityId: result.messageId,
      meta: { kinds: moderation.kinds.join(","), strikes: result.strikes },
    });
  }
  if (result.restrictedUntil) {
    await recordAudit({
      action: AuditAction.MESSAGING_RESTRICTED,
      actorId: input.senderId,
      entityType: "User",
      entityId: input.senderId,
      meta: { until: result.restrictedUntil.toISOString(), strikes: result.strikes },
    });
  }

  for (const other of others) {
    await notify({
      userId: other,
      type: NOTIFICATION_TYPES.MESSAGE_RECEIVED,
      title: "New message",
      body: "You have a new message on Gemstone Selections.",
      href: `/conversations/${input.conversationId}`,
    });
  }

  return {
    messageId: result.messageId,
    warning: moderation.flagged ? CONTACT_WARNING : null,
    restrictedUntil: result.restrictedUntil,
  };
}

/** Enquiry about a published listing. One conversation per buyer per listing. */
export async function startEnquiry(input: {
  buyerId: string;
  gemstoneId: string;
  body: string;
  files?: UploadedFile[];
}): Promise<{ conversationId: string; created: boolean; warning: string | null }> {
  const listing = await prisma.gemstone.findFirst({
    where: { id: input.gemstoneId, ...publicListingWhere() },
    select: { id: true, title: true, seller: { select: { userId: true } } },
  });
  if (!listing) throw new MessagingError("NOT_AVAILABLE", "This gemstone is no longer available to enquire about.");
  if (listing.seller.userId === input.buyerId) {
    throw new MessagingError("SELF_CONTACT", "You can't enquire about your own listing.");
  }
  if (input.body.trim().length === 0) throw new MessagingError("INVALID", "Write your enquiry before sending.");

  await assertCanMessage(input.buyerId, [listing.seller.userId]);
  await consumeOrThrow(`enquiry:user:${input.buyerId}`, RATE.enquiry, "You have started too many enquiries today. Try again tomorrow.");

  const { conversationId, created } = await getOrCreateConversation({
    kind: "ENQUIRY",
    pairKey: `enq:${listing.id}:${input.buyerId}`,
    startedById: input.buyerId,
    participantIds: [input.buyerId, listing.seller.userId],
    gemstoneId: listing.id,
  });

  if (created) {
    await recordAudit({
      action: AuditAction.ENQUIRY_STARTED,
      actorId: input.buyerId,
      entityType: "Conversation",
      entityId: conversationId,
      meta: { gemstoneId: listing.id },
    });
    await notify({
      userId: listing.seller.userId,
      type: NOTIFICATION_TYPES.ENQUIRY_RECEIVED,
      title: "New enquiry",
      body: "A buyer enquired about one of your listings.",
      href: `/conversations/${conversationId}`,
    });
  }

  const sent = await sendMessage({ conversationId, senderId: input.buyerId, body: input.body, files: input.files });
  return { conversationId, created, warning: sent.warning };
}

/** General conversation between two users, for example from a seller's portfolio page. */
export async function startGeneralConversation(input: {
  userId: string;
  targetUserId: string;
  body: string;
  files?: UploadedFile[];
}): Promise<{ conversationId: string; created: boolean; warning: string | null }> {
  if (input.userId === input.targetUserId) {
    throw new MessagingError("SELF_CONTACT", "You can't start a conversation with yourself.");
  }
  if (input.body.trim().length === 0) throw new MessagingError("INVALID", "Write your message before sending.");

  const target = await prisma.user.findUnique({
    where: { id: input.targetUserId },
    select: {
      role: true,
      status: true,
      emailVerifiedAt: true,
      sellerProfile: { select: { approvalStatus: true } },
    },
  });
  // Only approved, active sellers can be contacted through the platform.
  const contactable =
    target?.role === "SELLER" &&
    target.status === "ACTIVE" &&
    target.emailVerifiedAt !== null &&
    target.sellerProfile?.approvalStatus === "APPROVED";
  if (!target || !contactable) throw new MessagingError("NOT_AVAILABLE", "This seller can't be contacted right now.");

  await assertCanMessage(input.userId, [input.targetUserId]);
  await consumeOrThrow(`enquiry:user:${input.userId}`, RATE.enquiry, "You have started too many enquiries today. Try again tomorrow.");

  const [a, b] = [input.userId, input.targetUserId].sort();
  const { conversationId, created } = await getOrCreateConversation({
    kind: "GENERAL",
    pairKey: `gen:${a}:${b}`,
    startedById: input.userId,
    participantIds: [input.userId, input.targetUserId],
  });

  if (created) {
    await recordAudit({
      action: AuditAction.GENERAL_STARTED,
      actorId: input.userId,
      entityType: "Conversation",
      entityId: conversationId,
    });
    await notify({
      userId: input.targetUserId,
      type: NOTIFICATION_TYPES.ENQUIRY_RECEIVED,
      title: "New enquiry",
      body: "Someone wrote to you on Gemstone Selections.",
      href: `/conversations/${conversationId}`,
    });
  }

  const sent = await sendMessage({ conversationId, senderId: input.userId, body: input.body, files: input.files });
  return { conversationId, created, warning: sent.warning };
}

/** Marks the thread read for this user (read receipts and unread counts use lastReadAt). */
export async function markConversationRead(conversationId: string, userId: string, now = new Date()): Promise<boolean> {
  const updated = await prisma.conversationParticipant.updateMany({
    where: { conversationId, userId },
    data: { lastReadAt: now },
  });
  return updated.count > 0;
}

export interface ConversationListItem {
  id: string;
  kind: ConversationKind;
  isDemo: boolean;
  lastMessageAt: Date;
  gemstone: { id: string; title: string; slug: string } | null;
  requirement: { id: string; gemstoneType: string } | null;
  counterpart: { id: string; name: string | null; businessName: string | null; slug: string | null; role: string };
  lastMessage: { body: string; senderId: string; kind: MessageKind; createdAt: Date } | null;
  unreadCount: number;
  blocked: boolean;
}

/** Conversations the user is in, newest first. Search matches counterpart name, business or listing title. */
export async function listConversationsForUser(
  userId: string,
  options: { kind?: ConversationKind; q?: string; take?: number } = {},
): Promise<ConversationListItem[]> {
  const q = options.q?.trim();
  const rows = await prisma.conversation.findMany({
    where: {
      participants: { some: { userId } },
      ...(options.kind ? { kind: options.kind } : {}),
      ...(q
        ? {
            OR: [
              { gemstone: { title: { contains: q, mode: "insensitive" } } },
              {
                participants: {
                  some: {
                    userId: { not: userId },
                    user: {
                      OR: [
                        { name: { contains: q, mode: "insensitive" } },
                        { sellerProfile: { businessName: { contains: q, mode: "insensitive" } } },
                      ],
                    },
                  },
                },
              },
            ],
          }
        : {}),
    },
    orderBy: { lastMessageAt: "desc" },
    take: Math.min(options.take ?? 50, 100),
    select: {
      id: true,
      kind: true,
      isDemo: true,
      lastMessageAt: true,
      gemstone: { select: { id: true, title: true, slug: true } },
      requirement: { select: { id: true, gemstoneType: true } },
      participants: {
        select: {
          userId: true,
          lastReadAt: true,
          user: {
            select: {
              id: true,
              name: true,
              role: true,
              sellerProfile: { select: { businessName: true, slug: true } },
            },
          },
        },
      },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { body: true, senderId: true, kind: true, createdAt: true },
      },
    },
  });

  const items: ConversationListItem[] = [];
  for (const row of rows) {
    const me = row.participants.find((p) => p.userId === userId);
    const other = row.participants.find((p) => p.userId !== userId);
    if (!me || !other) continue;
    const unreadCount = await prisma.message.count({
      where: {
        conversationId: row.id,
        senderId: { not: userId },
        ...(me.lastReadAt ? { createdAt: { gt: me.lastReadAt } } : {}),
      },
    });
    const blocked = await isBlockedEitherWay(userId, other.userId);
    items.push({
      id: row.id,
      kind: row.kind,
      isDemo: row.isDemo,
      lastMessageAt: row.lastMessageAt,
      gemstone: row.gemstone,
      requirement: row.requirement,
      counterpart: {
        id: other.user.id,
        name: other.user.name,
        businessName: other.user.sellerProfile?.businessName ?? null,
        slug: other.user.sellerProfile?.slug ?? null,
        role: other.user.role,
      },
      lastMessage: row.messages[0] ?? null,
      unreadCount,
      blocked,
    });
  }
  return items;
}

/** Messages created after `since`, for polling. Only for participants; null when not a participant. */
export async function listMessagesSince(conversationId: string, userId: string, since: Date | null, take = 100) {
  const member = await prisma.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
    select: { lastReadAt: true },
  });
  if (!member) return null;
  const messages = await prisma.message.findMany({
    where: { conversationId, ...(since ? { createdAt: { gt: since } } : {}) },
    orderBy: { createdAt: "asc" },
    take,
    select: {
      id: true,
      kind: true,
      body: true,
      flagged: true,
      createdAt: true,
      senderId: true,
      attachments: { select: { id: true, fileName: true, mimeType: true, sizeBytes: true } },
      offer: {
        select: {
          id: true,
          amountMinor: true,
          currency: true,
          note: true,
          status: true,
          proposerId: true,
          counterOfId: true,
          respondedById: true,
        },
      },
      quotation: {
        select: {
          id: true,
          itemTitle: true,
          quantity: true,
          amountMinor: true,
          currency: true,
          validUntil: true,
          terms: true,
          status: true,
          sellerId: true,
          gemstoneId: true,
        },
      },
    },
  });
  const counterpart = await prisma.conversationParticipant.findFirst({
    where: { conversationId, userId: { not: userId } },
    select: { lastReadAt: true },
  });
  return { messages, myLastReadAt: member.lastReadAt, counterpartLastReadAt: counterpart?.lastReadAt ?? null };
}
