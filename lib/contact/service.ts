import { createHash } from "node:crypto";
import { getEnv } from "@/lib/config/env";
import { getEmailProvider } from "@/lib/notify/email";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import { renderContactEmail } from "./email";
import type { ContactInput } from "./schema";

export const CONTACT_LIMIT_PER_HOUR = 5;
const HOUR_SECONDS = 60 * 60;

export type ContactOutcome = "sent" | "rate_limited" | "unavailable";

/** Rate-limit key uses a hash of the IP so the raw address is not written to the rate-limit table. */
export function contactRateKey(ip: string): string {
  return `contact:ip:${createHash("sha256").update(`contact-rate|${ip}`).digest("hex")}`;
}

/**
 * Sends one contact message to the admin team. Nothing is stored in the database: the message exists only
 * in the outgoing email. Logs never include the message body or the visitor's details.
 */
export async function submitContactMessage(input: ContactInput, ip: string): Promise<ContactOutcome> {
  const limit = await consumeRateLimit({
    key: contactRateKey(ip),
    limit: CONTACT_LIMIT_PER_HOUR,
    windowSeconds: HOUR_SECONDS,
  });
  if (!limit.allowed) return "rate_limited";

  const recipient = getEnv().ADMIN_EMAIL;
  if (!recipient) {
    console.error("[contact] ADMIN_EMAIL is not set; contact message was not delivered");
    return "unavailable";
  }

  try {
    await getEmailProvider().send({ to: recipient, ...renderContactEmail(input) });
    return "sent";
  } catch {
    // Provider errors can echo addresses, so only a fixed message is logged.
    console.error("[contact] email provider failed; contact message was not delivered");
    return "unavailable";
  }
}
