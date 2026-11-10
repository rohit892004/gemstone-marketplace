import { appUrl } from "@/lib/config/app-url";
import type { EmailMessage } from "@/lib/notify/email";

/**
 * Newsletter email copy. Plain text. Every message carries a preferences link and an unsubscribe link.
 * The postal address line is a placeholder until the client confirms the registered business address
 * (required in the footer of marketing email).
 */

export const POSTAL_ADDRESS_PLACEHOLDER = "[Registered business address: to be confirmed before launch]";

export function manageUrl(token: string): string {
  return appUrl(`/newsletter/preferences?token=${encodeURIComponent(token)}`);
}

export function unsubscribeUrl(token: string): string {
  return appUrl(`/newsletter/unsubscribe?token=${encodeURIComponent(token)}`);
}

/** One-click unsubscribe (RFC 8058). The POST endpoint takes the same token. */
export function unsubscribeHeaders(token: string): Record<string, string> {
  return {
    "List-Unsubscribe": `<${appUrl(`/api/newsletter/unsubscribe?token=${encodeURIComponent(token)}`)}>, <${unsubscribeUrl(token)}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

export function confirmationEmail(input: { to: string; confirmUrl: string }): EmailMessage {
  return {
    to: input.to,
    subject: "Confirm your Gemstone Selections newsletter",
    text: [
      "Thank you for signing up to the Gemstone Selections newsletter.",
      "",
      "Confirm your address to start receiving it:",
      input.confirmUrl,
      "",
      "The link works once and expires in 48 hours. If you did not ask for this, ignore this email. Nothing will be sent to you.",
      "",
      POSTAL_ADDRESS_PLACEHOLDER,
    ].join("\n"),
  };
}

export function alreadySubscribedEmail(input: { to: string; manageUrl: string }): EmailMessage {
  return {
    to: input.to,
    subject: "You are already subscribed to Gemstone Selections",
    text: [
      "You already receive the Gemstone Selections newsletter.",
      "",
      "To change your topics or unsubscribe, use this link:",
      input.manageUrl,
      "",
      "If you did not ask for this, you can ignore this email.",
      "",
      POSTAL_ADDRESS_PLACEHOLDER,
    ].join("\n"),
  };
}

/** Footer added to every campaign and digest message. */
export function newsletterFooter(input: { manageUrl: string; unsubscribeUrl: string }): string {
  return [
    "",
    "--",
    "You receive this because you chose these topics at Gemstone Selections.",
    `Change topics: ${input.manageUrl}`,
    `Unsubscribe: ${input.unsubscribeUrl}`,
    POSTAL_ADDRESS_PLACEHOLDER,
  ].join("\n");
}
