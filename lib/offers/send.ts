import { AuditAction } from "@/lib/audit/actions";
import { recordAudit } from "@/lib/audit/audit";
import { prisma } from "@/lib/db/client";
import { assertCanMessage, CONTACT_WARNING, MessagingError } from "@/lib/messaging/service";
import { recordContactStrike } from "@/lib/messaging/strikes";
import { moderateContactDetails, type ContactKind } from "@/lib/messaging/moderation";
import { formatMoney, MAX_MINOR } from "@/lib/money/money";
import { publicListingWhere } from "@/lib/listings/visibility";
import { NOTIFICATION_TYPES, notify } from "@/lib/notifications/service";
import { consumeRateLimit } from "@/lib/security/rate-limit";

/**
 * Buyer offers on a listing conversation. The seller accepts, declines or counters in the seller
 * agent's flow; this module only sends. No payments.
 *
 * Rules:
 *  - Buyer role only. Participant only. Not blocked, not restricted (assertCanMessage).
 *  - Listing (ENQUIRY) conversations only. The listing must still be publicly visible.
 *  - Amount is a positive integer in minor units, at most MAX_MINOR. Currency INR or USD.
 *  - Note is optional, at most OFFER_NOTE_MAX characters, and moderated like a message.
 *  - One PENDING offer per buyer per conversation. A second offer waits until the first is answered.
 *  - Same rate limit bucket as messages (msg:user:<id>).
 *  - The offer is a Message (kind OFFER) plus an Offer row (PENDING), written in one transaction.
 */

export const OFFER_NOTE_MAX = 500;
export const OFFER_CURRENCIES = ["INR", "USD"] as const;
export type OfferCurrency = (typeof OFFER_CURRENCIES)[number];

/** Same bucket and window as sendMessage in lib/messaging/service.ts. */
const OFFER_RATE = { limit: 30, windowSeconds: 10 * 60 } as const;

export type OfferValidation =
  | {
      ok: true;
      amountMinor: bigint;
      currency: OfferCurrency;
      note: { text: string | null; kinds: ContactKind[]; flagged: boolean };
    }
  | { ok: false; error: string };

/**
 * Pure validation of an offer. No database access.
 * The note is masked here, so the caller stores `note.text` and never the raw input.
 */
export function validateOfferInput(input: {
  amountMinor: bigint;
  currency: string;
  note?: string | null;
}): OfferValidation {
  if (typeof input.amountMinor !== "bigint" || input.amountMinor <= BigInt(0)) {
    return { ok: false, error: "Enter an offer amount greater than zero." };
  }
  if (input.amountMinor > MAX_MINOR) {
    return { ok: false, error: "That amount is too large to offer." };
  }
  if (!(OFFER_CURRENCIES as readonly string[]).includes(input.currency)) {
    return { ok: false, error: "Choose INR or USD." };
  }
  const rawNote = (input.note ?? "").trim();
  if (rawNote.length > OFFER_NOTE_MAX) {
    return { ok: false, error: `Keep the note to ${OFFER_NOTE_MAX} characters or fewer.` };
  }
  const moderated = rawNote.length > 0 ? moderateContactDetails(rawNote) : null;
  return {
    ok: true,
    amountMinor: input.amountMinor,
    currency: input.currency as OfferCurrency,
    note: {
      text: moderated ? moderated.text : null,
      kinds: moderated ? moderated.kinds : [],
      flagged: moderated ? moderated.flagged : false,
    },
  };
}

export interface SendOfferResult {
  offerId: string;
  messageId: string;
  /** Set when contact details were masked in the note. Show it to the buyer. */
  warning: string | null;
  restrictedUntil: Date | null;
}

export async function sendOffer(input: {
  buyerId: string;
  conversationId: string;
  amountMinor: bigint;
  currency: string;
  note?: string | null;
  now?: Date;
}): Promise<SendOfferResult> {
  const now = input.now ?? new Date();
  const checked = validateOfferInput(input);
  if (!checked.ok) throw new MessagingError("INVALID", checked.error);

  const buyer = await prisma.user.findUnique({ where: { id: input.buyerId }, select: { role: true } });
  if (buyer?.role !== "BUYER") throw new MessagingError("NOT_AVAILABLE", "Only buyers can make an offer.");

  const conversation = await prisma.conversation.findFirst({
    where: { id: input.conversationId, participants: { some: { userId: input.buyerId } } },
    select: { id: true, kind: true, gemstoneId: true, participants: { select: { userId: true } } },
  });
  if (!conversation) throw new MessagingError("NOT_FOUND", "Conversation not found.");
  if (conversation.kind !== "ENQUIRY" || !conversation.gemstoneId) {
    throw new MessagingError("NOT_AVAILABLE", "Offers can only be sent on a gemstone enquiry.");
  }

  const listing = await prisma.gemstone.findFirst({
    where: { id: conversation.gemstoneId, ...publicListingWhere() },
    select: { id: true, title: true, seller: { select: { userId: true } } },
  });
  if (!listing) throw new MessagingError("NOT_AVAILABLE", "This gemstone is no longer available to make an offer on.");

  const sellerId = listing.seller.userId;
  if (sellerId === input.buyerId || !conversation.participants.some((p) => p.userId === sellerId)) {
    throw new MessagingError("NOT_FOUND", "Conversation not found.");
  }

  await assertCanMessage(input.buyerId, [sellerId], now);
  const limit = await consumeRateLimit({ key: `msg:user:${input.buyerId}`, ...OFFER_RATE });
  if (!limit.allowed) {
    throw new MessagingError("RATE_LIMITED", "You are sending messages too quickly. Try again shortly.", limit.retryAfterSeconds);
  }

  const amountText = formatMoney(checked.amountMinor, checked.currency) ?? "";
  const body = `Offer of ${amountText}`;
  const { note } = checked;

  const result = await prisma.$transaction(async (tx) => {
    // Lock the conversation row so two offers from one buyer cannot both pass the pending check.
    await tx.$queryRaw`SELECT "id" FROM "Conversation" WHERE "id" = ${input.conversationId} FOR UPDATE`;

    const pending = await tx.offer.findFirst({
      where: { conversationId: input.conversationId, proposerId: input.buyerId, status: "PENDING" },
      select: { id: true },
    });
    if (pending) {
      throw new MessagingError(
        "INVALID",
        "You already have an offer waiting for a reply. You can send another once the seller has answered.",
      );
    }

    const message = await tx.message.create({
      data: {
        conversationId: input.conversationId,
        senderId: input.buyerId,
        kind: "OFFER",
        body,
        flagged: note.flagged,
        createdAt: now,
      },
      select: { id: true },
    });
    const offer = await tx.offer.create({
      data: {
        conversationId: input.conversationId,
        messageId: message.id,
        proposerId: input.buyerId,
        amountMinor: checked.amountMinor,
        currency: checked.currency,
        note: note.text,
        status: "PENDING",
      },
      select: { id: true },
    });
    await tx.conversation.update({ where: { id: input.conversationId }, data: { lastMessageAt: now } });
    await tx.conversationParticipant.update({
      where: { conversationId_userId: { conversationId: input.conversationId, userId: input.buyerId } },
      data: { lastReadAt: now },
    });

    if (!note.flagged) {
      return { offerId: offer.id, messageId: message.id, strikes: 0, restrictedUntil: null as Date | null };
    }

    await tx.moderationFlag.create({
      data: {
        conversationId: input.conversationId,
        messageId: message.id,
        senderId: input.buyerId,
        source: "OFFER",
        kinds: note.kinds,
      },
    });
    const strike = await recordContactStrike(tx, input.buyerId, now);
    return { offerId: offer.id, messageId: message.id, ...strike };
  });

  await recordAudit({
    action: AuditAction.OFFER_SENT,
    actorId: input.buyerId,
    entityType: "Offer",
    entityId: result.offerId,
    meta: { conversationId: input.conversationId, currency: checked.currency, flagged: note.flagged },
  });
  if (note.flagged) {
    await recordAudit({
      action: AuditAction.MESSAGE_FLAGGED,
      actorId: input.buyerId,
      entityType: "Message",
      entityId: result.messageId,
      meta: { kinds: note.kinds.join(","), strikes: result.strikes, source: "OFFER" },
    });
  }
  if (result.restrictedUntil) {
    await recordAudit({
      action: AuditAction.MESSAGING_RESTRICTED,
      actorId: input.buyerId,
      entityType: "User",
      entityId: input.buyerId,
      meta: { until: result.restrictedUntil.toISOString(), strikes: result.strikes },
    });
  }

  await notify({
    userId: sellerId,
    type: NOTIFICATION_TYPES.OFFER_RECEIVED,
    title: "New offer",
    body: `A buyer made an offer of ${amountText} on one of your listings.`,
    href: `/conversations/${input.conversationId}`,
  });

  return {
    offerId: result.offerId,
    messageId: result.messageId,
    warning: note.flagged ? CONTACT_WARNING : null,
    restrictedUntil: result.restrictedUntil,
  };
}
