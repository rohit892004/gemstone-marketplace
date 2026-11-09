"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { BUYER_REGISTER_FIELDS, submitBuyerRegistration } from "@/lib/auth/flows/register";
import type { FormState } from "@/lib/auth/flows/form-state";
import { getClientIp } from "@/lib/security/client-ip";

/**
 * Buyer sign-up. Every outcome that is not a validation or rate-limit error redirects to
 * the same "check your email" page, so existing and new addresses look identical.
 */
export async function registerBuyer(_previous: FormState, formData: FormData): Promise<FormState> {
  const ip = getClientIp(await headers());
  const raw = Object.fromEntries(BUYER_REGISTER_FIELDS.map((field) => [field, String(formData.get(field) ?? "")]));

  const result = await submitBuyerRegistration(raw, ip);
  if (!result.ok) return result.state;

  redirect("/check-email");
}
