"use server";

import { headers } from "next/headers";
import { INVALID_PREFERENCES_LINK, UNSUBSCRIBED_MESSAGE, type NewsletterActionResult } from "@/lib/newsletter/messages";
import { unsubscribeByToken } from "@/lib/newsletter/service";
import { getClientIp } from "@/lib/security/client-ip";

/** Unsubscribe from everything. Idempotent. */
export async function unsubscribeAction(_prev: NewsletterActionResult, formData: FormData): Promise<NewsletterActionResult> {
  const token = formData.get("token");
  if (typeof token !== "string" || token.length === 0) return { ok: false, message: INVALID_PREFERENCES_LINK };
  const ok = await unsubscribeByToken(token, { ip: getClientIp(await headers()), source: "unsubscribe-page" });
  return ok ? { ok: true, message: UNSUBSCRIBED_MESSAGE } : { ok: false, message: INVALID_PREFERENCES_LINK };
}
