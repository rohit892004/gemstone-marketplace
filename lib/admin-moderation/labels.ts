import type { ConversationKind, MessageKind, ReportReason, ReportStatus, RequirementStatus } from "@/app/generated/prisma/client";
import type { ContactKind } from "@/lib/messaging/moderation";

/** Display labels for M3 admin pages. Plain text only; nothing here is user-written. */

export const CONTACT_KIND_LABELS: Record<ContactKind, string> = {
  PHONE: "Phone number",
  EMAIL: "Email address",
  URL: "Website or link",
  HANDLE: "@handle",
  PLATFORM: "Messaging app handle",
};

export const FLAG_SOURCE_LABELS: Record<string, string> = {
  MESSAGE: "Message",
  OFFER: "Offer note",
  QUOTATION: "Quotation",
  REQUIREMENT: "Requirement notes",
  PUBLIC_PROFILE: "Seller profile text",
  PUBLIC_LISTING: "Listing text",
  PUBLIC_QUOTATION: "Quotation text (refused)",
};

export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  SPAM: "Spam",
  SCAM: "Scam or fraud",
  HARASSMENT: "Harassment",
  FAKE_LISTING: "Fake listing",
  OTHER: "Other",
};

export const REPORT_STATUS_LABELS: Record<ReportStatus, string> = {
  OPEN: "Open",
  RESOLVED: "Resolved",
  DISMISSED: "Dismissed",
};

export const REQUIREMENT_STATUS_LABELS: Record<RequirementStatus, string> = {
  OPEN: "Open",
  CLOSED: "Closed",
};

export const CONVERSATION_KIND_LABELS: Record<ConversationKind, string> = {
  ENQUIRY: "Enquiry about a listing",
  GENERAL: "General conversation",
  REQUIREMENT: "Requirement response",
};

export const MESSAGE_KIND_LABELS: Record<MessageKind, string> = {
  TEXT: "Message",
  OFFER: "Offer",
  QUOTATION: "Quotation",
  SYSTEM: "System note",
};

/** "PHONE" -> "Phone number". Unknown kinds show as-is, never as a value. */
export function contactKindLabel(kind: string): string {
  return (CONTACT_KIND_LABELS as Record<string, string>)[kind] ?? kind.toLowerCase();
}

export function flagSourceLabel(source: string): string {
  return FLAG_SOURCE_LABELS[source] ?? "Other";
}
