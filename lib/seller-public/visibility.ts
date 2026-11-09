/**
 * Pure visibility rules for public seller and listing pages. Kept free of I/O so the
 * rules can be unit tested directly.
 */

export interface ProductDocumentLike {
  isPublic: boolean;
  verificationStatus: string;
}

/**
 * Documents shown on a product page: public AND VERIFIED only. The query also filters;
 * this is the second line of defence before anything reaches the UI.
 */
export function visibleDocuments<T extends ProductDocumentLike>(docs: readonly T[]): T[] {
  return docs.filter((d) => d.isPublic === true && d.verificationStatus === "VERIFIED");
}

/** The Verified badge on a product is shown only when at least one document is visible. */
export function showVerifiedBadge<T extends ProductDocumentLike>(docs: readonly T[]): boolean {
  return visibleDocuments(docs).length > 0;
}

/** Same rule as publicListingWhere(), applied to rows already loaded in memory. */
export function isPubliclyVisible(listing: {
  status: string;
  availability: string;
  seller: { approvalStatus: string };
}): boolean {
  return (
    listing.status === "PUBLISHED" &&
    listing.availability !== "HIDDEN" &&
    listing.seller.approvalStatus === "APPROVED"
  );
}
