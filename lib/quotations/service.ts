import { AuditAction } from "@/lib/audit/actions";
import { recordAudit } from "@/lib/audit/audit";
import { prisma } from "@/lib/db/client";
import { isBlockedEitherWay, getConversationForParticipant } from "@/lib/messaging/access";
import { assertCanMessage, MessagingError } from "@/lib/messaging/service";
import { NOTIFICATION_TYPES, notify } from "@/lib/notifications/service";
import { CommerceError } from "@/lib/commerce/errors";
import { consumeCommerceLimit } from "@/lib/commerce/strikes";
import { recordBlockedPublicText } from "@/lib/moderation/public-text";
import { publicTextBlockedMessage } from "@/lib/moderation/scan";
import {
  effectiveQuotationStatus,
  isQuotationExpired,
  quotationSides,
  validateQuotation,
  type QuotationDraft,
} from "./validate";

/**
 * Quotation domain rules. Callers pass the acting user ID from the server session, never from the client.
 *
 *  - Only the seller side of an ENQUIRY or REQUIREMENT conversation can send a quotation.
 *    A GENERAL conversation has no buyer side, so it cannot carry a quotation.
 *  - Only the seller who sent a quotation can withdraw it, and only while SENT.
 *  - Only the buyer side can accept or decline, and only while SENT and not expired.
 *  - Expiry: SENT with validUntil in the past is EXPIRED. Reads compute it, and any write that
 *    touches the row stores EXPIRED.
 */

export interface CreateQuotationInput extends QuotationDraft {
  conversationId: string;
  sellerId: string;
  gemstoneId?: string | null;
  now?: Date;
}

export async function createQuotation(input: CreateQuotationInput): Promise<{ quotationId: string; warning: string | null }> {
  const now = input.now ?? new Date();
  const conversation = await getConversationForParticipant(input.conversationId, input.sellerId);
  if (!conversation) throw new CommerceError("NOT_FOUND", "This conversation is not available.");
  if (conversation.requirement?.status === "CLOSED") {
    throw new CommerceError("CLOSED", "This requirement is closed, so no new quotations can be sent.");
  }

  const sides = quotationSides(conversation, input.sellerId);
  if (!sides || !sides.viewerIsSeller) {
    throw new CommerceError("NOT_ALLOWED", "Quotations can only be sent by the seller in an enquiry or requirement.");
  }

  const check = validateQuotation(input, now);
  if (!check.ok) throw new CommerceError("INVALID", check.error);
  const value = check.value;

  // The item title and terms are sent to the buyer as written, so contact details are refused, not masked.
  // The attempt is logged as public text and does not count toward the messaging restriction.
  if (value.flagged) {
    const labels = [...(value.titleKinds.length > 0 ? ["Item title"] : []), ...(value.termsKinds.length > 0 ? ["Terms"] : [])];
    await recordBlockedPublicText({
      senderId: input.sellerId,
      source: "PUBLIC_QUOTATION",
      kinds: value.kinds,
      conversationId: input.conversationId,
      now,
    });
    throw new CommerceError("INVALID", publicTextBlockedMessage(labels));
  }

  await assertCanMessage(input.sellerId, [sides.buyerId], now);
  await consumeCommerceLimit(input.sellerId);

  if (input.gemstoneId) {
    const owned = await prisma.gemstone.findFirst({
      where: { id: input.gemstoneId, seller: { userId: input.sellerId } },
      select: { id: true },
    });
    if (!owned) throw new MessagingError("NOT_AVAILABLE", "Choose one of your own listings, or leave it blank.");
  }

  const body = `Quotation: ${value.itemTitle}`;
  const created = await prisma.$transaction(async (tx) => {
    const message = await tx.message.create({
      data: {
        conversationId: input.conversationId,
        senderId: input.sellerId,
        kind: "QUOTATION",
        body,
        flagged: false,
        createdAt: now,
      },
      select: { id: true },
    });
    const quotation = await tx.quotation.create({
      data: {
        conversationId: input.conversationId,
        messageId: message.id,
        sellerId: input.sellerId,
        gemstoneId: input.gemstoneId || null,
        itemTitle: value.itemTitle,
        quantity: value.quantity,
        amountMinor: value.amountMinor,
        currency: value.currency,
        validUntil: value.validUntil,
        terms: value.terms,
        status: "SENT",
        createdAt: now,
      },
      select: { id: true },
    });
    await tx.conversation.update({ where: { id: input.conversationId }, data: { lastMessageAt: now } });
    await tx.conversationParticipant.update({
      where: { conversationId_userId: { conversationId: input.conversationId, userId: input.sellerId } },
      data: { lastReadAt: now },
    });
    return { quotationId: quotation.id, messageId: message.id };
  });

  await recordAudit({
    action: AuditAction.QUOTATION_SENT,
    actorId: input.sellerId,
    entityType: "Quotation",
    entityId: created.quotationId,
    meta: { conversationId: input.conversationId, currency: value.currency, flagged: false },
  });

  await notify({
    userId: sides.buyerId,
    type: NOTIFICATION_TYPES.QUOTATION_RECEIVED,
    title: "New quotation",
    body: "A seller sent you a quotation on Gemstone Selections. Open the conversation to accept or decline it.",
    href: `/conversations/${input.conversationId}`,
  });

  return { quotationId: created.quotationId, warning: null };
}

/** Loads a quotation only for participants of its conversation. Null otherwise. */
async function loadQuotationForParticipant(quotationId: string, userId: string) {
  return prisma.quotation.findFirst({
    where: { id: quotationId, conversation: { participants: { some: { userId } } } },
    include: {
      conversation: {
        select: {
          id: true,
          kind: true,
          startedById: true,
          isDemo: true,
          participants: { select: { userId: true } },
          requirement: { select: { buyerId: true, status: true } },
        },
      },
    },
  });
}

async function markExpired(quotationId: string) {
  await prisma.quotation.updateMany({ where: { id: quotationId, status: "SENT" }, data: { status: "EXPIRED" } });
}

export async function withdrawQuotation(input: { quotationId: string; sellerId: string; now?: Date }) {
  const now = input.now ?? new Date();
  const quotation = await loadQuotationForParticipant(input.quotationId, input.sellerId);
  if (!quotation || quotation.sellerId !== input.sellerId) {
    throw new CommerceError("NOT_FOUND", "This quotation is not available.");
  }
  await consumeCommerceLimit(input.sellerId);

  if (quotation.status !== "SENT") {
    throw new CommerceError("CONFLICT", `This quotation can't be withdrawn because it is ${quotation.status.toLowerCase()}.`);
  }
  if (isQuotationExpired(quotation, now)) {
    await markExpired(quotation.id);
    throw new CommerceError("EXPIRED", "This quotation has already expired.");
  }

  const updated = await prisma.quotation.updateMany({
    where: { id: quotation.id, status: "SENT" },
    data: { status: "WITHDRAWN", withdrawnAt: now },
  });
  if (updated.count === 0) throw new CommerceError("CONFLICT", "This quotation has already been answered.");

  await recordAudit({
    action: AuditAction.QUOTATION_WITHDRAWN,
    actorId: input.sellerId,
    entityType: "Quotation",
    entityId: quotation.id,
  });
  const buyerId = quotationSides(quotation.conversation, input.sellerId)?.buyerId;
  if (buyerId) {
    await notify({
      userId: buyerId,
      type: NOTIFICATION_TYPES.QUOTATION_RESPONDED,
      title: "Quotation withdrawn",
      body: "A seller withdrew a quotation on Gemstone Selections.",
      href: `/conversations/${quotation.conversationId}`,
    });
  }
  return { status: "WITHDRAWN" as const, conversationId: quotation.conversationId };
}

export async function respondToQuotation(input: {
  quotationId: string;
  buyerId: string;
  decision: "ACCEPT" | "DECLINE";
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const quotation = await loadQuotationForParticipant(input.quotationId, input.buyerId);
  if (!quotation) throw new CommerceError("NOT_FOUND", "This quotation is not available.");
  const sides = quotationSides(quotation.conversation, input.buyerId);
  if (!sides || sides.viewerIsSeller) {
    throw new CommerceError("NOT_ALLOWED", "Only the buyer can accept or decline this quotation.");
  }
  if (await isBlockedEitherWay(input.buyerId, quotation.sellerId)) {
    throw new CommerceError("NOT_ALLOWED", "You can't respond to this quotation.");
  }
  await consumeCommerceLimit(input.buyerId);

  if (quotation.status !== "SENT") {
    throw new CommerceError("CONFLICT", `This quotation has already been ${quotation.status.toLowerCase()}.`);
  }
  if (isQuotationExpired(quotation, now)) {
    await markExpired(quotation.id);
    throw new CommerceError("EXPIRED", "This quotation has expired, so it can no longer be accepted or declined.");
  }

  const status: "ACCEPTED" | "DECLINED" = input.decision === "ACCEPT" ? "ACCEPTED" : "DECLINED";
  const updated = await prisma.quotation.updateMany({
    where: { id: quotation.id, status: "SENT" },
    data: { status, respondedAt: now },
  });
  if (updated.count === 0) throw new CommerceError("CONFLICT", "This quotation has already been answered.");

  await recordAudit({
    action: AuditAction.QUOTATION_RESPONDED,
    actorId: input.buyerId,
    entityType: "Quotation",
    entityId: quotation.id,
    meta: { decision: status },
  });
  await notify({
    userId: quotation.sellerId,
    type: NOTIFICATION_TYPES.QUOTATION_RESPONDED,
    title: status === "ACCEPTED" ? "Quotation accepted" : "Quotation declined",
    body: `The buyer ${status === "ACCEPTED" ? "accepted" : "declined"} your quotation on Gemstone Selections.`,
    href: `/conversations/${quotation.conversationId}`,
  });
  return { status, conversationId: quotation.conversationId };
}

/** Sets EXPIRED on the seller's SENT quotations that are past validity. Called when the seller lists them. */
export async function expireStaleQuotationsForSeller(sellerId: string, now = new Date()): Promise<void> {
  await prisma.quotation.updateMany({
    where: { sellerId, status: "SENT", validUntil: { lte: now } },
    data: { status: "EXPIRED" },
  });
}

/** Everything the PDF needs, for participants only. Null for anyone else. */
export async function loadQuotationForPdf(quotationId: string, userId: string, now = new Date()) {
  const quotation = await prisma.quotation.findFirst({
    where: { id: quotationId, conversation: { participants: { some: { userId } } } },
    select: {
      id: true,
      conversationId: true,
      itemTitle: true,
      quantity: true,
      amountMinor: true,
      currency: true,
      validUntil: true,
      terms: true,
      status: true,
      createdAt: true,
      conversation: { select: { isDemo: true } },
      seller: { select: { sellerProfile: { select: { businessName: true } } } },
    },
  });
  if (!quotation) return null;
  return {
    id: quotation.id,
    conversationId: quotation.conversationId,
    itemTitle: quotation.itemTitle,
    quantity: quotation.quantity,
    amountMinor: quotation.amountMinor,
    currency: quotation.currency,
    validUntil: quotation.validUntil,
    terms: quotation.terms,
    status: effectiveQuotationStatus(quotation, now),
    createdAt: quotation.createdAt,
    isDemo: quotation.conversation.isDemo,
    businessName: quotation.seller.sellerProfile?.businessName ?? "Seller",
  };
}
