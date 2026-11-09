"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { completePasswordReset } from "@/lib/auth/flows/password-reset";
import type { FormState } from "@/lib/auth/flows/form-state";
import { MESSAGES } from "@/lib/auth/flows/messages";
import { getClientIp } from "@/lib/security/client-ip";
import { resetPasswordSchema } from "@/lib/validation/schemas";

/**
 * Sets a new password. The token is consumed here (not on page load), so a mail scanner
 * that prefetches the link cannot use it up. Password rules are checked before consumption,
 * so a typo does not burn the link.
 */
export async function resetPassword(_previous: FormState, formData: FormData): Promise<FormState> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  const parsed = resetPasswordSchema.safeParse({ token, password, confirmPassword });
  if (!parsed.success) {
    const flat = z.flattenError(parsed.error);
    if (flat.fieldErrors.token) {
      return { error: MESSAGES.invalidLink, invalidLink: true };
    }
    const fieldErrors = Object.fromEntries(
      Object.entries(flat.fieldErrors).map(([field, messages]) => [field, messages?.[0] ?? "Check this field"]),
    );
    return { fieldErrors, error: "Please fix the highlighted fields." };
  }

  const ip = getClientIp(await headers());
  const ok = await completePasswordReset(parsed.data.token, parsed.data.password, ip);
  if (!ok) {
    return { error: MESSAGES.invalidLink, invalidLink: true };
  }

  redirect("/login?reset=1");
}
