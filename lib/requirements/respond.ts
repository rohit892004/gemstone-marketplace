import { Prisma } from "@/app/generated/prisma/client";
import { AuditAction } from "@/lib/audit/actions";
import { recordAudit } from "@/lib/audit/audit";
import { CommerceError } from "@/lib/commerce/errors";
import { consumeRequirementResponseLimit } from "@/lib/commerce/strikes";
import { prisma } from "@/lib/db/client";
import { isOwnRequirement } from "@/lib/messaging/guards";
import { assertCanMessage, getOrCreateConversation, MESSAGE_MAX_CHARS, sendMessage } from "@/lib/messaging/service";
import { NOTIFICATION_TYPES, notify } from "@/lib/notifications/service";

/**
 * Seller responses to a buyer requirement. Each response opens one REQUIREMENT conversation per seller
 * per requirement, pairKey "req:<requirementId>:<sellerUserId>". The seller's first message goes through
 * sendMessage, so masking, blocks, restrictions and the message rate limit all apply.
 *
 * Response cap: at most REQUIREMENT_RESPONSE_CAP sellers can respond to one requirement. This stops a
 * popular requirement from being flooded. Buyers see the count, not the sellers' details.
 */

export const REQUIREMENT_RESPONSE_CAP = 50;

export interface RequirementForResponse {
  buyerId: string;
  status: string;
  deadline: Date | null;
  categoryId: string | null;
}

/** Null when the seller may respond now, otherwise the reason. Pure. */
export function requirementResponseProblem(
  requirement: RequirementForResponse,
  seller: { sellerId: string; categoryIds: string[] },
  now: Date,
): CommerceError | null {
  if (isOwnRequirement(seller.sellerId, requirement.buyerId)) {
    return new CommerceError("NOT_ALLOWED", "You can't respond to your own requirement.");
  }
  if (requirement.status !== "OPEN") return new CommerceError("CLOSED", "This requirement is closed.");
  if (requirement.deadline && requirement.deadline.getTime() < now.getTime()) {
    return new CommerceError("CLOSED", "The deadline for this requirement has passed.");
  }
  if (!requirement.categoryId || !seller.categoryIds.includes(requirement.categoryId)) {
    return new CommerceError("NOT_ALLOWED", "This requirement is outside your gemstone categories.");
  }
  return null;
}

export async function respondToRequirement(input: {
  requirementId: string;
  sellerId: string;
  body: string;
  now?: Date;
}): Promise<{ conversationId: string; warning: string | null }> {
  const now = input.now ?? new Date();

  const profile = await prisma.sellerProfile.findUnique({
    where: { userId: input.sellerId },
    select: { approvalStatus: true, categories: { select: { id: true } } },
  });
  if (!profile || profile.approvalStatus !== "APPROVED") {
    throw new CommerceError("NOT_ALLOWED", "Only approved sellers can respond to requirements.");
  }

  const requirement = await prisma.requirement.findUnique({
    where: { id: input.requirementId },
    select: { id: true, buyerId: true, status: true, deadline: true, categoryId: true, isDemo: true },
  });
  if (!requirement) throw new CommerceError("NOT_ALLOWED", "This requirement is not available to respond to.");

  const existing = await prisma.requirementResponse.findUnique({
    where: { requirementId_sellerId: { requirementId: requirement.id, sellerId: input.sellerId } },
    select: { conversationId: true },
  });
  if (existing) {
    throw new CommerceError(
      "CONFLICT",
      "You have already responded to this requirement. Open your conversation to continue.",
      existing.conversationId,
    );
  }

  const problem = requirementResponseProblem(
    requirement,
    { sellerId: input.sellerId, categoryIds: profile.categories.map((c) => c.id) },
    now,
  );
  // One message for every reason (missing, closed, out of category, past deadline), so a seller
  // cannot tell which requirement IDs exist.
  if (problem) throw new CommerceError("NOT_ALLOWED", "This requirement is not available to respond to.");

  const body = input.body.trim();
  if (body.length === 0) throw new CommerceError("INVALID", "Write your response before sending.");
  if (body.length > MESSAGE_MAX_CHARS) {
    throw new CommerceError("INVALID", `Messages can be ${MESSAGE_MAX_CHARS} characters or fewer.`);
  }

  const responses = await prisma.requirementResponse.count({ where: { requirementId: requirement.id } });
  if (responses >= REQUIREMENT_RESPONSE_CAP) {
    throw new CommerceError("CONFLICT", "This requirement already has as many responses as it can take.");
  }

  await assertCanMessage(input.sellerId, [requirement.buyerId], now);
  await consumeRequirementResponseLimit(input.sellerId);

  const { conversationId, created } = await getOrCreateConversation({
    kind: "REQUIREMENT",
    pairKey: `req:${requirement.id}:${input.sellerId}`,
    startedById: input.sellerId,
    participantIds: [requirement.buyerId, input.sellerId],
    requirementId: requirement.id,
    isDemo: requirement.isDemo,
  });

  try {
    await prisma.requirementResponse.create({
      data: { requirementId: requirement.id, sellerId: input.sellerId, conversationId },
    });
  } catch (error) {
    // A concurrent response from the same seller hit the unique constraint.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new CommerceError("CONFLICT", "You have already responded to this requirement.", conversationId);
    }
    throw error;
  }

  let sent;
  try {
    sent = await sendMessage({ conversationId, senderId: input.sellerId, body, now });
  } catch (error) {
    // The response slot is only kept when the first message went out. Otherwise the seller can retry.
    await prisma.requirementResponse.deleteMany({ where: { requirementId: requirement.id, sellerId: input.sellerId } });
    throw error;
  }

  await recordAudit({
    action: AuditAction.REQUIREMENT_RESPONDED,
    actorId: input.sellerId,
    entityType: "Requirement",
    entityId: requirement.id,
    meta: { conversationId, newConversation: created },
  });
  await notify({
    userId: requirement.buyerId,
    type: NOTIFICATION_TYPES.REQUIREMENT_RESPONSE,
    title: "New response to your requirement",
    body: "A seller responded to your gemstone requirement on Gemstone Selections. Open the conversation to read it.",
    href: `/conversations/${conversationId}`,
  });

  return { conversationId, warning: sent.warning };
}
