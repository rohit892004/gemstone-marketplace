import { createHash } from "node:crypto";
import { recordAudit } from "@/lib/audit/audit";
import { AuditAction } from "@/lib/audit/actions";
import { getEnv } from "@/lib/config/env";
import { linkSecret } from "@/lib/newsletter/service";
import { hashIp } from "@/lib/newsletter/tokens";
import { getEmailProvider } from "@/lib/notify/email";
import { moderateContactDetails } from "@/lib/messaging/moderation";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import { renderContactEmail } from "./email";
import type { ContactField, ContactInput } from "./schema";

export const CONTACT_LIMIT_PER_HOUR = 5;
const HOUR_SECONDS = 60 * 60;

/** Shown on the message field when it contains contact details. The detected value is never repeated. */
export const CONTACT_MESSAGE_REFUSAL =
  "Please do not include phone numbers, email addresses, links, social media handles or app names in your message. Our team will reply to the email address you give us.";

/** Shown on the name field when it contains contact details. */
export const CONTACT_NAME_REFUSAL =
  "Please do not include phone numbers, email addresses, links, social media handles or app names in your name.";

export type ContactOutcome =
  | { status: "sent" }
  | { status: "refused"; fieldErrors: Partial<Record<ContactField, string>> }
  | { status: "rate_limited" }
  | { status: "unavailable" };

/** Rate-limit key uses a hash of the IP so the raw address is not written to the rate-limit table. */
export function contactRateKey(ip: string): string {
  return `contact:ip:${createHash("sha256").update(`contact-rate|${ip}`).digest("hex")}`;
}

/**
 * Contact-detail check on the free-text fields, using the same detector as seller public text. Returns one
 * fixed sentence per field that contains contact details. Pure: nothing is masked, stored or echoed.
 */
export function contactDetailErrors(input: Pick<ContactInput, "name" | "message">): Partial<Record<ContactField, string>> {
  const errors: Partial<Record<ContactField, string>> = {};
  if (moderateContactDetails(input.name).flagged) errors.name = CONTACT_NAME_REFUSAL;
  if (moderateContactDetails(input.message).flagged) errors.message = CONTACT_MESSAGE_REFUSAL;
  return errors;
}

/**
 * Sends one contact message to the admin team. Order: contact-detail check, rate limit, send, audit. A refused
 * message is not sent, does not use the hourly allowance and is not audited. Nothing is stored in the database
 * except the audit row, which holds the topic, a keyed hash of the IP and the signed-in user id (if any).
 * Logs never include the message body or the visitor's details.
 */
export async function submitContactMessage(
  input: ContactInput,
  ip: string,
  actorId: string | null = null,
): Promise<ContactOutcome> {
  const fieldErrors = contactDetailErrors(input);
  if (Object.keys(fieldErrors).length > 0) return { status: "refused", fieldErrors };

  const limit = await consumeRateLimit({
    key: contactRateKey(ip),
    limit: CONTACT_LIMIT_PER_HOUR,
    windowSeconds: HOUR_SECONDS,
  });
  if (!limit.allowed) return { status: "rate_limited" };

  const recipient = getEnv().ADMIN_EMAIL;
  if (!recipient) {
    console.error("[contact] ADMIN_EMAIL is not set; contact message was not delivered");
    return { status: "unavailable" };
  }

  try {
    await getEmailProvider().send({ to: recipient, ...renderContactEmail(input) });
  } catch {
    // Provider errors can echo addresses, so only a fixed message is logged.
    console.error("[contact] email provider failed; contact message was not delivered");
    return { status: "unavailable" };
  }

  await recordAudit({
    action: AuditAction.CONTACT_SUBMITTED,
    actorId,
    entityType: "ContactMessage",
    entityId: null,
    ip: hashIp(ip, linkSecret()),
    meta: { topic: input.topic },
  });
  return { status: "sent" };
}
