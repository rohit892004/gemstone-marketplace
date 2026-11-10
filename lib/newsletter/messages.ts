import type { ConfirmOutcome } from "./state";

/** Copy shared by the public newsletter pages. Kept neutral: nothing reveals whether an address exists. */

/** Result of a newsletter form action, shown in an aria-live region. */
export type NewsletterActionResult = { ok: true; message: string } | { ok: false; message: string } | null;

export const CONSENT_TEXT =
  "I agree that Gemstone Selections may email me the topics I choose. I understand I must confirm my address from the email I receive first. Every email has a link to change my topics or unsubscribe.";

export const SIGNUP_ACCEPTED_MESSAGE =
  "Thank you. If this address can receive our newsletter, we have sent a confirmation link. Check your inbox and spam folder.";

export const CONFIRM_OUTCOME_COPY: Record<ConfirmOutcome, { ok: boolean; message: string }> = {
  CONFIRMED: { ok: true, message: "You are subscribed. Thank you for confirming." },
  ALREADY_CONFIRMED: { ok: true, message: "This subscription is already confirmed. There is nothing more to do." },
  EXPIRED: { ok: false, message: "This confirmation link has expired. Sign up again and we will send a new one." },
  INVALID: {
    ok: false,
    message: "This confirmation link is not valid or has already been used. If you signed up, use the newest email from us.",
  },
};

export const INVALID_PREFERENCES_LINK =
  "This link is not valid. Use the newest email from us, or sign up again to receive a fresh link.";

export const UNSUBSCRIBED_MESSAGE = "You have been unsubscribed. You will not receive the newsletter again unless you sign up.";
