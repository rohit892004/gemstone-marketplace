import type { Prisma } from "@/app/generated/prisma/client";
import type { ContactKind } from "@/lib/messaging/moderation";
import { RESTRICTION_HOURS } from "@/lib/messaging/service";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import { CommerceError } from "./errors";

/** Quotations and offer responses share one budget per user: 30 actions per 24 hours. */
export const COMMERCE_RATE = { limit: 30, windowSeconds: 24 * 60 * 60 } as const;
/** Requirement responses: 10 per 24 hours per user. */
export const REQUIREMENT_RESPONSE_RATE = { limit: 10, windowSeconds: 24 * 60 * 60 } as const;

export async function consumeCommerceLimit(userId: string): Promise<void> {
  const result = await consumeRateLimit({ key: `commerce:user:${userId}`, ...COMMERCE_RATE });
  if (!result.allowed) {
    throw new CommerceError("RATE_LIMITED", "You have made too many quotation or offer actions today. Try again tomorrow.");
  }
}

export async function consumeRequirementResponseLimit(userId: string): Promise<void> {
  const result = await consumeRateLimit({ key: `reqresp:user:${userId}`, ...REQUIREMENT_RESPONSE_RATE });
  if (!result.allowed) {
    throw new CommerceError("RATE_LIMITED", "You have responded to too many requirements today. Try again tomorrow.");
  }
}

/**
 * Records a contact-detail flag for a quotation, offer, requirement note or public seller text. Same policy as chat messages:
 * the first strike is a warning, a second strike starts a temporary messaging restriction.
 * Runs inside the caller's transaction.
 */
export async function recordContactFlag(
  tx: Prisma.TransactionClient,
  input: {
    /** Null for requirement notes, which have no conversation. */
    conversationId: string | null;
    messageId: string | null;
    requirementId?: string | null;
    senderId: string;
    source: "OFFER" | "QUOTATION" | "REQUIREMENT";
    kinds: ContactKind[];
    now: Date;
  },
): Promise<{ strikes: number; restrictedUntil: Date | null }> {
  await tx.moderationFlag.create({
    data: {
      conversationId: input.conversationId,
      messageId: input.messageId,
      requirementId: input.requirementId ?? null,
      senderId: input.senderId,
      source: input.source,
      kinds: input.kinds,
    },
  });
  const sender = await tx.user.update({
    where: { id: input.senderId },
    data: { contactStrikes: { increment: 1 } },
    select: { contactStrikes: true },
  });
  if (sender.contactStrikes < 2) return { strikes: sender.contactStrikes, restrictedUntil: null };
  const restrictedUntil = new Date(input.now.getTime() + RESTRICTION_HOURS * 60 * 60 * 1000);
  await tx.user.update({ where: { id: input.senderId }, data: { messagingRestrictedUntil: restrictedUntil } });
  return { strikes: sender.contactStrikes, restrictedUntil };
}
