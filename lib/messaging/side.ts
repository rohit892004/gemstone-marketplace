import type { ConversationKind, Prisma } from "@/app/generated/prisma/client";

/**
 * Which side of a conversation a user is on. A seller is on the BUYING side when they started the
 * conversation as a buyer (an enquiry on another seller's listing, a chat to another seller, or the
 * poster of a requirement). Everything else is SELLING.
 *
 * The side rule matches quotationSides(): enquiries and general chats are buyer-led by startedById,
 * requirement threads are buyer-led by requirement.buyerId.
 */

export type ConversationSide = "BUYING" | "SELLING";
export type SideFilter = "buying" | "selling";

export function conversationSide(
  conversation: { kind: ConversationKind; startedById: string; requirement?: { buyerId: string } | null },
  userId: string,
): ConversationSide {
  const buyerId = conversation.kind === "REQUIREMENT" ? conversation.requirement?.buyerId : conversation.startedById;
  return buyerId === userId ? "BUYING" : "SELLING";
}

/** Prisma filter for the inbox tabs. Mirrors conversationSide() exactly. */
export function sideWhere(userId: string, side: SideFilter): Prisma.ConversationWhereInput {
  if (side === "buying") {
    return {
      OR: [{ requirement: { is: { buyerId: userId } } }, { requirementId: null, startedById: userId }],
    };
  }
  return {
    OR: [{ requirement: { is: { buyerId: { not: userId } } } }, { requirementId: null, startedById: { not: userId } }],
  };
}
