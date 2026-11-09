import type { AuditActionName } from "@/lib/audit/actions";
import { recordAudit, type AuditEntry } from "@/lib/audit/audit";

/**
 * Audit names for catalogue moderation. They are NOT yet in lib/audit/actions.ts (owned by the
 * lead). Until they are added there, the values are cast when written. Lead: add these to
 * AuditAction, then drop the cast in recordCatalogueAudit.
 *
 *   LISTING_APPROVED          "listing.approved"
 *   LISTING_REJECTED          "listing.rejected"
 *   LISTING_FEATURED_CHANGED  "listing.featured_changed"
 *   DOCUMENT_VERIFIED         "listing_document.verified"
 *   DOCUMENT_REJECTED         "listing_document.rejected"
 *   REVIEW_APPROVED           "review.approved"
 *   REVIEW_REJECTED           "review.rejected"
 *   HOMEPAGE_BLOCK_CHANGED    "homepage.block_changed"
 *   SETTING_CHANGED           "setting.changed"
 */
export const CATALOGUE_AUDIT = {
  LISTING_APPROVED: "listing.approved",
  LISTING_REJECTED: "listing.rejected",
  LISTING_FEATURED_CHANGED: "listing.featured_changed",
  DOCUMENT_VERIFIED: "listing_document.verified",
  DOCUMENT_REJECTED: "listing_document.rejected",
  REVIEW_APPROVED: "review.approved",
  REVIEW_REJECTED: "review.rejected",
  HOMEPAGE_BLOCK_CHANGED: "homepage.block_changed",
  SETTING_CHANGED: "setting.changed",
} as const;

export type CatalogueAuditName = (typeof CATALOGUE_AUDIT)[keyof typeof CATALOGUE_AUDIT];

export function recordCatalogueAudit(entry: Omit<AuditEntry, "action"> & { action: CatalogueAuditName }): Promise<void> {
  // Temporary cast: see the header comment. Remove once the names are in AuditAction.
  return recordAudit({ ...entry, action: entry.action as unknown as AuditActionName });
}
