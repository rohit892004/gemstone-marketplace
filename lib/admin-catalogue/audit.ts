import { type AuditActionName, AuditAction } from "@/lib/audit/actions";
import { recordAudit, type AuditEntry } from "@/lib/audit/audit";

/** Catalogue moderation audit names (defined in lib/audit/actions.ts). */
export const CATALOGUE_AUDIT = {
  LISTING_APPROVED: AuditAction.LISTING_APPROVED,
  LISTING_REJECTED: AuditAction.LISTING_REJECTED,
  LISTING_FEATURED_CHANGED: AuditAction.LISTING_FEATURED_CHANGED,
  DOCUMENT_VERIFIED: AuditAction.DOCUMENT_VERIFIED,
  DOCUMENT_REJECTED: AuditAction.DOCUMENT_REJECTED,
  REVIEW_APPROVED: AuditAction.REVIEW_APPROVED,
  REVIEW_REJECTED: AuditAction.REVIEW_REJECTED,
  HOMEPAGE_BLOCK_CHANGED: AuditAction.HOMEPAGE_BLOCK_CHANGED,
  SETTING_CHANGED: AuditAction.SETTING_CHANGED,
} as const;

export type CatalogueAuditName = (typeof CATALOGUE_AUDIT)[keyof typeof CATALOGUE_AUDIT];

export function recordCatalogueAudit(entry: Omit<AuditEntry, "action"> & { action: CatalogueAuditName }): Promise<void> {
  return recordAudit({ ...entry, action: entry.action satisfies AuditActionName });
}
