import { prisma } from "@/lib/db/client";
import type { AuditActionName } from "./actions";

export interface AuditEntry {
  action: AuditActionName;
  /** Acting user id, or undefined for anonymous events (e.g. failed login). */
  actorId?: string | null;
  /** Target entity, e.g. entityType "SellerProfile", entityId the profile id. */
  entityType: string;
  entityId?: string | null;
  /** Client IP, if known. Use getClientIp(headers). */
  ip?: string | null;
  /** Small, non-sensitive context. Never store passwords, tokens or OTPs. */
  meta?: Record<string, string | number | boolean | null>;
}

/**
 * Writes one audit row. Audit writes must not break the user flow, so errors are
 * logged and swallowed. Failing to audit a security event is still visible in logs.
 */
export async function recordAudit(entry: AuditEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        action: entry.action,
        actorId: entry.actorId ?? null,
        entityType: entry.entityType,
        entityId: entry.entityId ?? null,
        ip: entry.ip ?? null,
        meta: entry.meta ?? undefined,
      },
    });
  } catch (error) {
    console.error("[audit] failed to record", entry.action, error);
  }
}
