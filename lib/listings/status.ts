/**
 * Listing moderation state machine. Every status change goes through these checks.
 *
 *   DRAFT ──submit──▶ PENDING_REVIEW ──approve──▶ PUBLISHED
 *     ▲                    │                         │
 *     └─────edit/withdraw──┴──reject──▶ REJECTED ◀───┘ (unpublish sends back to DRAFT)
 *
 * Auto-publish (admin setting, default off): submit goes straight to PUBLISHED for APPROVED sellers.
 */

export type ListingStatusValue = "DRAFT" | "PENDING_REVIEW" | "PUBLISHED" | "REJECTED" | "ARCHIVED";

export type ListingTransition = "submit" | "approve" | "reject" | "unpublish" | "edit";

export function canTransition(from: ListingStatusValue, action: ListingTransition): boolean {
  switch (action) {
    case "submit":
      return from === "DRAFT" || from === "REJECTED";
    case "approve":
      return from === "PENDING_REVIEW";
    case "reject":
      return from === "PENDING_REVIEW";
    case "unpublish":
      return from === "PUBLISHED";
    case "edit":
      // Editing a published listing returns it to DRAFT so changes are reviewed again.
      return from !== "ARCHIVED";
  }
}

/** Status a listing gets when the seller submits it. */
export function statusOnSubmit(sellerApproved: boolean, autoPublish: boolean): "PENDING_REVIEW" | "PUBLISHED" {
  return sellerApproved && autoPublish ? "PUBLISHED" : "PENDING_REVIEW";
}

/** Status after an edit: published listings need re-review; drafts and rejected stay as they are. */
export function statusAfterEdit(current: ListingStatusValue): ListingStatusValue {
  return current === "PUBLISHED" ? "DRAFT" : current;
}
