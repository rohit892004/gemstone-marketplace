import { moderateContactDetails } from "@/lib/messaging/moderation";

/**
 * Pure notification rules. No database, no providers, so every rule here has a unit test.
 * service.ts uses these; nothing here imports it.
 */

export const NOTIFICATION_TYPES = {
  ENQUIRY_RECEIVED: "enquiry.received",
  MESSAGE_RECEIVED: "message.received",
  OFFER_RECEIVED: "offer.received",
  OFFER_RESPONDED: "offer.responded",
  QUOTATION_RECEIVED: "quotation.received",
  QUOTATION_RESPONDED: "quotation.responded",
  REQUIREMENT_MATCH: "requirement.match",
  REQUIREMENT_RESPONSE: "requirement.response",
  ADMIN_ALERT: "admin.alert",
  VALUATION_STATUS: "valuation.status",
  VALUATION_INFO_REQUESTED: "valuation.info_requested",
  VALUATION_INFO_ANSWERED: "valuation.info_answered",
  VALUATION_ASSIGNED: "valuation.assigned",
} as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[keyof typeof NOTIFICATION_TYPES];

/**
 * Message emails are batched: at most one message email per user per window. Messages that arrive
 * inside the window wait for the next digest (lib/notifications/service.ts, flushMessageDigests).
 */
export const DIGEST_WINDOW_MS = 10 * 60 * 1000;

export interface NotificationPrefs {
  emailEnabled: boolean;
  enquiries: boolean;
  messages: boolean;
  offersAndQuotes: boolean;
  requirements: boolean;
  valuations: boolean;
}

export const DEFAULT_PREFS: NotificationPrefs = {
  emailEnabled: true,
  enquiries: true,
  messages: true,
  offersAndQuotes: true,
  requirements: true,
  valuations: true,
};

export type PrefCategory = Exclude<keyof NotificationPrefs, "emailEnabled">;

/** Which preference switch governs a notification type. Unknown types return null and are never emailed. */
export function categoryFor(type: string): PrefCategory | null {
  if (type.startsWith("enquiry.")) return "enquiries";
  if (type.startsWith("message.")) return "messages";
  if (type.startsWith("offer.") || type.startsWith("quotation.")) return "offersAndQuotes";
  if (type.startsWith("requirement.")) return "requirements";
  if (type.startsWith("valuation.")) return "valuations";
  return null;
}

/** True when the recipient's preferences allow an email for this type. */
export function shouldEmail(prefs: NotificationPrefs, type: string): boolean {
  // Admin alerts are operational (for example, a seller hitting the public-text refusal threshold).
  // They are emailed regardless of preferences.
  if (type.startsWith("admin.")) return true;
  const category = categoryFor(type);
  if (category === null) return false;
  return prefs.emailEnabled && prefs[category];
}

/** A digest may go out when no message email was sent yet, or the last one is older than the window. */
export function digestDue(lastEmailedAt: Date | null, now: Date, windowMs: number = DIGEST_WINDOW_MS): boolean {
  if (lastEmailedAt === null) return true;
  return now.getTime() - lastEmailedAt.getTime() >= windowMs;
}

/** Fixed digest copy. Only the count is interpolated; no message text is ever included. */
export function digestCopy(count: number, conversationsUrl: string): { subject: string; text: string } {
  const noun = count === 1 ? "message" : "messages";
  return {
    subject: "Gemstone Selections: new messages",
    text:
      `You have ${count} new ${noun} on Gemstone Selections.\n\n` +
      `Open your conversations here: ${conversationsUrl}\n\n` +
      "Messages stay on the platform. Change email preferences in your account settings.",
  };
}

/** Used when a title or body would contain a contact detail. The real text never leaves the app. */
export const FALLBACK_NOTIFICATION = {
  title: "Update on Gemstone Selections",
  body: "You have a new update on Gemstone Selections. Open it on the site to see the details.",
} as const;

/**
 * Safety net for notification text. Callers should already pass fixed text, but a title or body that
 * contains a phone number, email, URL or handle is replaced with the fallback instead of being sent.
 */
export function safeNotificationText(input: { title: string; body: string }): {
  title: string;
  body: string;
  replaced: boolean;
} {
  const flagged = moderateContactDetails(input.title).flagged || moderateContactDetails(input.body).flagged;
  if (flagged) return { ...FALLBACK_NOTIFICATION, replaced: true };
  return { title: input.title, body: input.body, replaced: false };
}

/** Links in notifications must be app paths. Anything else falls back to the centre. */
export function isSafeHref(href: string): boolean {
  return href.startsWith("/") && !href.startsWith("//") && !href.includes("\\");
}
