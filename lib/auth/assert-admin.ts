import { prisma } from "@/lib/db/client";
import { AuthzError } from "./authz-error";

/**
 * Role check for service functions. requireRole() reads the session, so it cannot run inside a service that
 * receives an actor id. This re-reads the actor from the database and refuses unless the account is an ACTIVE
 * ADMIN. Call it as the first line of every admin-only service function.
 */
export async function assertActiveAdmin(adminId: string | undefined): Promise<void> {
  if (!adminId) throw new AuthzError("UNAUTHENTICATED");
  const actor = await prisma.user.findUnique({ where: { id: adminId }, select: { role: true, status: true } });
  if (!actor || actor.role !== "ADMIN" || actor.status !== "ACTIVE") {
    throw new AuthzError("FORBIDDEN");
  }
}
