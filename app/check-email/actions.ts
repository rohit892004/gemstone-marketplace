"use server";

import { resendVerificationLink } from "@/lib/auth/flows/email-verification";
import type { FormState } from "@/lib/auth/flows/form-state";
import { MESSAGES } from "@/lib/auth/flows/messages";
import { emailSchema } from "@/lib/validation/schemas";

/**
 * Resend a verification link. The response is the same whether or not the account exists
 * or is already verified. Only malformed input and the rate limit get a different message.
 */
export async function resendVerification(_previous: FormState, formData: FormData): Promise<FormState> {
  const raw = String(formData.get("email") ?? "");
  const parsed = emailSchema.safeParse(raw);
  if (!parsed.success) {
    return { fieldErrors: { email: "Enter a valid email address" }, values: { email: raw } };
  }

  const result = await resendVerificationLink(parsed.data);
  if (result === "limited") {
    return { error: MESSAGES.tooManyAttempts, values: { email: parsed.data } };
  }
  return { notice: MESSAGES.resendSent, done: true };
}
