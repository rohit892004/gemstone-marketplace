/**
 * Canonical audit action names. Use these constants; never pass free-form strings.
 * Format: "<area>.<event>".
 */
export const AuditAction = {
  REGISTER_BUYER: "auth.register.buyer",
  REGISTER_SELLER: "auth.register.seller",
  REGISTER_DUPLICATE_ATTEMPT: "auth.register.duplicate_attempt",
  EMAIL_VERIFIED: "auth.email.verified",
  OTP_SENT: "auth.mobile.otp_sent",
  MOBILE_VERIFIED: "auth.mobile.verified",
  LOGIN_SUCCESS: "auth.login.success",
  LOGIN_FAILED: "auth.login.failed",
  LOGIN_BLOCKED: "auth.login.blocked",
  LOGOUT: "auth.logout",
  PASSWORD_RESET_REQUESTED: "auth.password.reset_requested",
  PASSWORD_RESET_COMPLETED: "auth.password.reset_completed",
  ACCESS_DENIED: "authz.denied",
  SELLER_APPROVED: "seller.approved",
  SELLER_REJECTED: "seller.rejected",
  SELLER_SUSPENDED: "seller.suspended",
  SELLER_REACTIVATED: "seller.reactivated",
  DOCUMENT_DOWNLOADED: "seller.document.downloaded",
  // Catalogue moderation (M2)
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

export type AuditActionName = (typeof AuditAction)[keyof typeof AuditAction];
