import type { Prisma } from "@/app/generated/prisma/client";
import { AuditAction } from "@/lib/audit/actions";
import { auditInTransaction, type AuditMeta } from "@/lib/admin-moderation/audit";
import { RESTRICTION_DAYS, restrictionUntil } from "@/lib/admin-moderation/restriction";

/**
 * Sets a messaging restriction inside the caller's transaction and writes MESSAGING_RESTRICTED.
 * The restriction is never shortened. Throws when the user does not exist, which rolls back the
 * caller's transaction.
 */
export async function restrictMessaging(
  tx: Prisma.TransactionClient,
  input: { userId: string; actorId: string; ip: string | null; now: Date; meta: AuditMeta },
): Promise<Date> {
  const user = await tx.user.findUnique({
    where: { id: input.userId },
    select: { messagingRestrictedUntil: true },
  });
  if (!user) throw new Error("RESTRICT_TARGET_MISSING");

  const until = restrictionUntil(input.now, user.messagingRestrictedUntil);
  await tx.user.update({ where: { id: input.userId }, data: { messagingRestrictedUntil: until } });
  await auditInTransaction(tx, {
    action: AuditAction.MESSAGING_RESTRICTED,
    actorId: input.actorId,
    entityType: "User",
    entityId: input.userId,
    ip: input.ip,
    meta: { ...input.meta, until: until.toISOString(), days: RESTRICTION_DAYS },
  });
  return until;
}
