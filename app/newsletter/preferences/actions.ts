"use server";

import { headers } from "next/headers";
import type { NewsletterActionResult } from "@/lib/newsletter/messages";
import { updateTopicsByToken } from "@/lib/newsletter/service";
import { getClientIp } from "@/lib/security/client-ip";

/** Saves topic choices made from a signed preferences link. Works without a login. */
export async function saveTopicsAction(_prev: NewsletterActionResult, formData: FormData): Promise<NewsletterActionResult> {
  const token = formData.get("token");
  if (typeof token !== "string" || token.length === 0) return { ok: false, message: "This link is not valid." };
  const topics = formData.getAll("topics").filter((v): v is string => typeof v === "string");
  const result = await updateTopicsByToken(token, topics, { ip: getClientIp(await headers()) });
  return result.ok ? { ok: true, message: "Your topics are saved." } : { ok: false, message: result.message };
}
