import type { VerificationStatus } from "@/app/generated/prisma/client";

export const MAX_LISTING_DOCUMENTS = 10;

/**
 * A seller may delete a document unless it has been verified. Verified documents are replaced
 * through admin review. Pending and rejected documents can be deleted in any listing status.
 */
export function canSellerDeleteDocument(doc: { verificationStatus: VerificationStatus }): boolean {
  return doc.verificationStatus !== "VERIFIED";
}

export function canAddDocument(existingCount: number): boolean {
  return existingCount < MAX_LISTING_DOCUMENTS;
}
