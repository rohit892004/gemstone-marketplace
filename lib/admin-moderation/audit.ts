import type { Prisma } from "@/app/generated/prisma/client";
import { AuditAction, type AuditActionName } from "@/lib/audit/actions";

/**
 * Audit helpers for M3 admin writes.
 *
 * recordAudit() is best-effort (it logs and swallows errors). For admin writes that must be
 * audited, the audit row is written INSIDE the same database transaction as the change. If the
 * audit insert fails, the transaction rolls back and the change does not happen. That is the
 * fail-closed rule from viewConversationAsAdmin, applied to every write.
 */

/**
 * Requested from the lead: add `SELLER_CATEGORIES_CHANGED: "seller.categories_changed"` to
 * lib/audit/actions.ts, then point this constant at AuditAction. Defined here until then so the
 * admin write can still be audited without editing a file this milestone does not own.
 */
export const SELLER_CATEGORIES_CHANGED = AuditAction.SELLER_CATEGORIES_CHANGED;

export type ModerationAuditName = AuditActionName | typeof SELLER_CATEGORIES_CHANGED;

export type AuditMeta = Record<string, string | number | boolean | null>;

export interface ModerationAuditEntry {
  action: ModerationAuditName;
  actorId: string;
  entityType: string;
  entityId: string;
  ip?: string | null;
  /** Small context only. Never a contact detail, token or password. */
  meta?: AuditMeta;
}

/** Writes one audit row. Throws on failure, so the caller's transaction rolls back. */
export async function auditInTransaction(tx: Prisma.TransactionClient, entry: ModerationAuditEntry): Promise<void> {
  await tx.auditLog.create({
    data: {
      action: entry.action,
      actorId: entry.actorId,
      entityType: entry.entityType,
      entityId: entry.entityId,
      ip: entry.ip ?? null,
      meta: entry.meta ?? undefined,
    },
  });
}

/** Thrown inside a transaction when the guarded update matched no row (someone else changed it first). */
export class StaleRecordError extends Error {
  constructor() {
    super("STALE_RECORD");
    this.name = "StaleRecordError";
  }
}

export const STALE_RECORD_MESSAGE =
  "This item changed while you were working. Reload the page and try again.";

export const SAVE_FAILED_MESSAGE = "The change could not be saved, so nothing was changed. Try again.";

/** Maps a failed admin transaction to a form error. Logs the error name only, never the data. */
export function transactionFailure(error: unknown, label: string): { ok: false; error: string } {
  if (error instanceof StaleRecordError) return { ok: false, error: STALE_RECORD_MESSAGE };
  console.error(`[admin] ${label} failed, nothing was changed`, error instanceof Error ? error.name : "unknown");
  return { ok: false, error: SAVE_FAILED_MESSAGE };
}
