"use server";

import { headers } from "next/headers";
import { requestPasswordReset } from "@/lib/auth/flows/password-reset";
import type { FormState } from "@/lib/auth/flows/form-state";
import { MESSAGES } from "@/lib/auth/flows/messages";
import { getClientIp } from "@/lib/security/client-ip";
import { forgotPasswordSchema } from "@/lib/validation/schemas";

/** Always returns the same notice for known and unknown emails. */
export async function forgotPassword(_previous: FormState, formData: FormData): Promise<FormState> {
  const raw = String(formData.get("email") ?? "");
  const parsed = forgotPasswordSchema.safeParse({ email: raw });
  if (!parsed.success) {
    return { fieldErrors: { email: "Enter a valid email address" }, values: { email: raw } };
  }

  const ip = getClientIp(await headers());
  const result = await requestPasswordReset(parsed.data.email, ip);
  if (result === "limited") {
    return { error: MESSAGES.tooManyAttempts, values: { email: parsed.data.email } };
  }
  return { notice: MESSAGES.forgotSent, done: true };
}
