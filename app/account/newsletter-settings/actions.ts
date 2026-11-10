"use server";

import { headers } from "next/headers";
import { requireBuyerFeatures } from "@/lib/auth/buyer-access";
import { AuthzError } from "@/lib/auth/require-role";
import { unsubscribeAccount, saveAccountTopics } from "@/lib/newsletter/account";
import type { NewsletterActionResult } from "@/lib/newsletter/messages";
import { getClientIp } from "@/lib/security/client-ip";

const SIGN_IN_MESSAGE = "Sign in to manage your newsletter settings.";

/** Subscribe, or change topics, from the account page. Always for the signed-in user's own email. */
export async function saveAccountNewsletterAction(_prev: NewsletterActionResult, formData: FormData): Promise<NewsletterActionResult> {
  let user;
  try {
    user = await requireBuyerFeatures();
  } catch (error) {
    if (error instanceof AuthzError) return { ok: false, message: SIGN_IN_MESSAGE };
    throw error;
  }
  const topics = formData.getAll("topics").filter((v): v is string => typeof v === "string");
  return saveAccountTopics(user, topics, getClientIp(await headers()));
}

/** Unsubscribe from the account page. */
export async function unsubscribeAccountNewsletterAction(): Promise<NewsletterActionResult> {
  let user;
  try {
    user = await requireBuyerFeatures();
  } catch (error) {
    if (error instanceof AuthzError) return { ok: false, message: SIGN_IN_MESSAGE };
    throw error;
  }
  return unsubscribeAccount(user, getClientIp(await headers()));
}
