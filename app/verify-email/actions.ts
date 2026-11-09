"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { verifyEmailToken } from "@/lib/auth/flows/email-verification";
import { getClientIp } from "@/lib/security/client-ip";
import { verifyEmailSchema } from "@/lib/validation/schemas";

/**
 * Consumes a verification token. Runs only on an explicit POST from the confirm button,
 * so mail scanners and link prefetchers (which issue GET requests) cannot burn the link.
 * The token is not echoed back in the redirect URL.
 */
export async function confirmEmailAction(formData: FormData): Promise<void> {
  const parsed = verifyEmailSchema.safeParse({ token: formData.get("token") });
  if (!parsed.success) redirect("/verify-email?status=invalid");

  const ip = getClientIp(await headers());
  const ok = await verifyEmailToken(parsed.data.token, ip);
  redirect(`/verify-email?status=${ok ? "ok" : "invalid"}`);
}
