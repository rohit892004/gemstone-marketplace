"use server";

import { headers } from "next/headers";
import { CONFIRM_OUTCOME_COPY, type NewsletterActionResult } from "@/lib/newsletter/messages";
import { confirmSubscription } from "@/lib/newsletter/service";
import { getClientIp } from "@/lib/security/client-ip";

/** Double opt-in. A POST, so link scanners that only fetch URLs cannot confirm an address. */
export async function confirmSubscriptionAction(_prev: NewsletterActionResult, formData: FormData): Promise<NewsletterActionResult> {
  const token = formData.get("token");
  if (typeof token !== "string" || token.length === 0) return CONFIRM_OUTCOME_COPY.INVALID;
  const outcome = await confirmSubscription(token, { ip: getClientIp(await headers()) });
  return CONFIRM_OUTCOME_COPY[outcome];
}
