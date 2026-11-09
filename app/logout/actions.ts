"use server";

import { headers } from "next/headers";
import { AuditAction } from "@/lib/audit/actions";
import { recordAudit } from "@/lib/audit/audit";
import { auth, signOut } from "@/lib/auth/auth";
import { getClientIp } from "@/lib/security/client-ip";

/** Ends the session, records the audit event for the signed-in user, then returns to the home page. */
export async function logout(): Promise<void> {
  const session = await auth();
  const actorId = session?.user?.id;
  if (actorId) {
    await recordAudit({
      action: AuditAction.LOGOUT,
      actorId,
      entityType: "User",
      entityId: actorId,
      ip: getClientIp(await headers()),
    });
  }
  await signOut({ redirectTo: "/" });
}
