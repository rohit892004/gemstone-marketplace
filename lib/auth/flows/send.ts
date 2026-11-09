import { getEmailProvider } from "@/lib/notify/email";
import type { Rendered } from "@/lib/notify/templates";

/**
 * Sends an email and logs (never throws) on failure. Callers must not reveal delivery
 * problems to the user, and the user can always request another email.
 */
export async function sendMailSafely(to: string, mail: Rendered): Promise<void> {
  try {
    await getEmailProvider().send({ to, ...mail });
  } catch (error) {
    console.error("[email] send failed", mail.subject, error);
  }
}
