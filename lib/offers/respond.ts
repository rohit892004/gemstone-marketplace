import { AuditAction } from "@/lib/audit/actions";
import { recordAudit } from "@/lib/audit/audit";
import { prisma } from "@/lib/db/client";
import { isBlockedEitherWay } from "@/lib/messaging/access";
import { moderateContactDetails, type ContactKind } from "@/lib/messaging/moderation";
import { assertCanMessage, CONTACT_WARNING } from "@/lib/messaging/service";
import { NOTIFICATION_TYPES, notify } from "@/lib/notifications/service";
import { CommerceError } from "@/lib/commerce/errors";
import { consumeCommerceLimit, recordContactFlag } from "@/lib/commerce/strikes";
import { parseAmountToMinor, MAX_AMOUNT_MINOR } from "@/lib/quotations/validate";

/**
 * Offer responses (seller side, and the counter-offer step for either side).
 *
 *  - Only the non-proposer can answer an offer, and only while PENDING.
 *  - Accept or decline sets the offer's final status.
 *  - A counter is a new Offer with counterOfId set to the earlier offer. The earlier offer becomes
 *    COUNTERED in the same transaction. The DB unique constraint on counterOfId stops a second counter.
 *  - No payments. Amounts are minor units.
 */

export const COUNTER_NOTE_MAX = 500;

export interface OfferForResponse {
  id: string;
  status: string;
  proposerId: string;
  amountMinor: bigint;
  currency: string;
}

/** Null when the responder may answer this offer now, otherwise the reason. Pure. */
export function offerResponseProblem(offer: Pick<OfferForResponse, "status" | "proposerId">, responderId: string): CommerceError | null {
  if (offer.proposerId === responderId) {
    return new CommerceError("NOT_ALLOWED", "You can't respond to your own offer.");
  }
  if (offer.status !== "PENDING") {
    return new CommerceError("CONFLICT", `This offer has already been ${offer.status.toLowerCase()}.`);
  }
  return null;
}

export type CounterValidation =
  | { ok: true; value: { amountMinor: bigint; note: string | null; flagged: boolean; kinds: ContactKind[] } }
  | { ok: false; error: string };

/**
 * Validates a counter. The currency stays the same as the offer being countered. The new amount must be
 * a positive amount within the platform limit, and must differ from the amount being countered.
 */
export function validateCounterOffer(input: { amount: string; note: string }, original: { amountMinor: bigint }): CounterValidation {
  const amountMinor = parseAmountToMinor(input.amount);
  if (amountMinor === null) return { ok: false, error: "Enter a counter amount greater than zero, with at most two decimal places." };
  if (amountMinor > MAX_AMOUNT_MINOR) return { ok: false, error: "That amount is too large." };
  if (amountMinor === original.amountMinor) return { ok: false, error: "Counter with a different amount." };

  const note = input.note.trim();
  if (note.length > COUNTER_NOTE_MAX) return { ok: false, error: `Notes can be ${COUNTER_NOTE_MAX} characters or fewer.` };
  const masked = note.length > 0 ? moderateContactDetails(note) : null;
  return {
    ok: true,
    value: {
      amountMinor,
      note: masked ? masked.text : null,
      flagged: masked ? masked.flagged : false,
      kinds: masked ? masked.kinds : [],
    },
  };
}

async function loadOfferForParticipant(offerId: string, userId: string) {
  return prisma.offer.findFirst({
    where: { id: offerId, conversation: { participants: { some: { userId } } } },
    select: {
      id: true,
      conversationId: true,
      status: true,
      proposerId: true,
      amountMinor: true,
      currency: true,
      conversation: { select: { participants: { select: { userId: true } } } },
    },
  });
}

function counterpartOf(offer: { proposerId: string; conversation: { participants: { userId: string }[] } }, userId: string) {
  return offer.conversation.participants.map((p) => p.userId).find((id) => id !== userId) ?? null;
}

export async function respondToOffer(input: {
  offerId: string;
  responderId: string;
  decision: "ACCEPT" | "DECLINE";
  now?: Date;
}): Promise<{ status: "ACCEPTED" | "DECLINED"; conversationId: string }> {
  const now = input.now ?? new Date();
  const offer = await loadOfferForParticipant(input.offerId, input.responderId);
  if (!offer) throw new CommerceError("NOT_FOUND", "This offer is not available.");
  const problem = offerResponseProblem(offer, input.responderId);
  if (problem) throw problem;

  const otherId = counterpartOf(offer, input.responderId);
  if (otherId && (await isBlockedEitherWay(input.responderId, otherId))) {
    throw new CommerceError("NOT_ALLOWED", "You can't respond to this offer.");
  }
  await consumeCommerceLimit(input.responderId);

  const status = input.decision === "ACCEPT" ? "ACCEPTED" : "DECLINED";
  const updated = await prisma.offer.updateMany({
    where: { id: offer.id, status: "PENDING" },
    data: { status, respondedById: input.responderId, respondedAt: now },
  });
  if (updated.count === 0) throw new CommerceError("CONFLICT", "This offer has already been answered.");

  await recordAudit({
    action: AuditAction.OFFER_RESPONDED,
    actorId: input.responderId,
    entityType: "Offer",
    entityId: offer.id,
    meta: { decision: status },
  });
  await notify({
    userId: offer.proposerId,
    type: NOTIFICATION_TYPES.OFFER_RESPONDED,
    title: status === "ACCEPTED" ? "Offer accepted" : "Offer declined",
    body: `Your offer on Gemstone Selections was ${status === "ACCEPTED" ? "accepted" : "declined"}.`,
    href: `/conversations/${offer.conversationId}`,
  });
  return { status, conversationId: offer.conversationId };
}

export async function counterOffer(input: {
  offerId: string;
  responderId: string;
  amount: string;
  note: string;
  now?: Date;
}): Promise<{ offerId: string; conversationId: string; warning: string | null }> {
  const now = input.now ?? new Date();
  const original = await loadOfferForParticipant(input.offerId, input.responderId);
  if (!original) throw new CommerceError("NOT_FOUND", "This offer is not available.");
  const problem = offerResponseProblem(original, input.responderId);
  if (problem) throw problem;

  const otherId = counterpartOf(original, input.responderId);
  if (!otherId) throw new CommerceError("NOT_FOUND", "This offer is not available.");
  await assertCanMessage(input.responderId, [otherId], now);

  const check = validateCounterOffer(input, original);
  if (!check.ok) throw new CommerceError("INVALID", check.error);
  const value = check.value;

  await consumeCommerceLimit(input.responderId);

  const counter = await prisma.$transaction(async (tx) => {
    const closed = await tx.offer.updateMany({
      where: { id: original.id, status: "PENDING" },
      data: { status: "COUNTERED", respondedById: input.responderId, respondedAt: now },
    });
    if (closed.count === 0) throw new CommerceError("CONFLICT", "This offer has already been answered.");

    const message = await tx.message.create({
      data: {
        conversationId: original.conversationId,
        senderId: input.responderId,
        kind: "OFFER",
        body: "Counter offer",
        flagged: value.flagged,
        createdAt: now,
      },
      select: { id: true },
    });
    const created = await tx.offer.create({
      data: {
        conversationId: original.conversationId,
        messageId: message.id,
        proposerId: input.responderId,
        amountMinor: value.amountMinor,
        currency: original.currency,
        note: value.note,
        status: "PENDING",
        counterOfId: original.id,
        createdAt: now,
      },
      select: { id: true },
    });
    await tx.conversation.update({ where: { id: original.conversationId }, data: { lastMessageAt: now } });
    await tx.conversationParticipant.update({
      where: { conversationId_userId: { conversationId: original.conversationId, userId: input.responderId } },
      data: { lastReadAt: now },
    });
    let restrictedUntil: Date | null = null;
    let strikes = 0;
    if (value.flagged) {
      const result = await recordContactFlag(tx, {
        conversationId: original.conversationId,
        messageId: message.id,
        senderId: input.responderId,
        source: "OFFER",
        kinds: value.kinds,
        now,
      });
      restrictedUntil = result.restrictedUntil;
      strikes = result.strikes;
    }
    return { offerId: created.id, messageId: message.id, restrictedUntil, strikes };
  });

  await recordAudit({
    action: AuditAction.OFFER_SENT,
    actorId: input.responderId,
    entityType: "Offer",
    entityId: counter.offerId,
    meta: { conversationId: original.conversationId, counterOf: original.id, flagged: value.flagged },
  });
  await recordAudit({
    action: AuditAction.OFFER_RESPONDED,
    actorId: input.responderId,
    entityType: "Offer",
    entityId: original.id,
    meta: { decision: "COUNTERED" },
  });
  if (value.flagged) {
    await recordAudit({
      action: AuditAction.MESSAGE_FLAGGED,
      actorId: input.responderId,
      entityType: "Message",
      entityId: counter.messageId,
      meta: { kinds: value.kinds.join(","), strikes: counter.strikes, source: "OFFER" },
    });
  }
  if (counter.restrictedUntil) {
    await recordAudit({
      action: AuditAction.MESSAGING_RESTRICTED,
      actorId: input.responderId,
      entityType: "User",
      entityId: input.responderId,
      meta: { until: counter.restrictedUntil.toISOString(), strikes: counter.strikes },
    });
  }

  await notify({
    userId: otherId,
    type: NOTIFICATION_TYPES.OFFER_RECEIVED,
    title: "New counter offer",
    body: "You have a counter offer on Gemstone Selections. Open the conversation to accept, decline or counter it.",
    href: `/conversations/${original.conversationId}`,
  });

  return { offerId: counter.offerId, conversationId: original.conversationId, warning: value.flagged ? CONTACT_WARNING : null };
}

/** Offers in conversations the user is part of, newest first. Only participants see them. */
export async function listOffersForUser(userId: string, take = 100) {
  return prisma.offer.findMany({
    where: { conversation: { participants: { some: { userId } } } },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      conversationId: true,
      amountMinor: true,
      currency: true,
      note: true,
      status: true,
      proposerId: true,
      counterOfId: true,
      createdAt: true,
      conversation: {
        select: {
          isDemo: true,
          kind: true,
          gemstone: { select: { title: true } },
          participants: {
            select: {
              userId: true,
              user: { select: { name: true, role: true, sellerProfile: { select: { businessName: true } } } },
            },
          },
        },
      },
    },
  });
}
