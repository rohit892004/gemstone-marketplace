import type { Prisma } from "@/app/generated/prisma/client";
import { RESTRICTION_HOURS } from "./service";

/**
 * Contact-detail strike policy for writes outside sendMessage (offer notes, requirement notes).
 * Same policy as sendMessage: the first offence is a warning only; a repeat offence starts a
 * temporary messaging restriction. Must run inside the same transaction as the write it belongs to.
 */
export const STRIKES_BEFORE_RESTRICTION = 2;

export async function recordContactStrike(
  tx: Prisma.TransactionClient,
  userId: string,
  now: Date,
): Promise<{ strikes: number; restrictedUntil: Date | null }> {
  const user = await tx.user.update({
    where: { id: userId },
    data: { contactStrikes: { increment: 1 } },
    select: { contactStrikes: true },
  });
  if (user.contactStrikes < STRIKES_BEFORE_RESTRICTION) {
    return { strikes: user.contactStrikes, restrictedUntil: null };
  }
  const restrictedUntil = new Date(now.getTime() + RESTRICTION_HOURS * 60 * 60 * 1000);
  await tx.user.update({ where: { id: userId }, data: { messagingRestrictedUntil: restrictedUntil } });
  return { strikes: user.contactStrikes, restrictedUntil };
}
