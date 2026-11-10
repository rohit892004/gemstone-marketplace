import { prisma } from "@/lib/db/client";
import type { NewsletterActionResult } from "./messages";
import { requestSubscription, linkSecret, unsubscribeByToken } from "./service";
import { hashIp, signManageToken } from "./tokens";
import { normaliseTopics, type NewsletterTopicName } from "./topics";

/**
 * Newsletter settings for a signed-in account. The subscriber is matched by the account's email and linked
 * to the user (userId), so later changes from the account and from email links apply to the same row.
 */

export interface AccountNewsletterState {
  status: "PENDING" | "CONFIRMED" | "UNSUBSCRIBED";
  topics: NewsletterTopicName[];
}

export async function accountNewsletterState(user: { id: string; email: string }): Promise<AccountNewsletterState | null> {
  const row = await prisma.newsletterSubscriber.findFirst({
    where: { OR: [{ userId: user.id }, { email: user.email }] },
    select: { status: true, topics: true },
  });
  return row ? { status: row.status, topics: row.topics } : null;
}

export async function saveAccountTopics(
  user: { id: string; email: string },
  topics: readonly string[],
  ip: string | null,
): Promise<NewsletterActionResult> {
  const wanted = normaliseTopics([...topics]);
  if (wanted.length === 0) return { ok: false, message: "Choose at least one topic, or unsubscribe instead." };

  const row = await prisma.newsletterSubscriber.findUnique({ where: { email: user.email }, select: { id: true, status: true } });
  if (row?.status === "CONFIRMED") {
    try {
      await prisma.newsletterSubscriber.update({ where: { id: row.id }, data: { topics: wanted, userId: user.id } });
    } catch (error) {
      if ((error as { code?: string }).code === "P2002") return { ok: false, message: "This account is linked to another subscription. Contact us for help." };
      throw error;
    }
    await prisma.newsletterConsent.create({
      data: { subscriberId: row.id, action: "TOPICS_CHANGED", topics: wanted, source: "account", ipHash: hashIp(ip, linkSecret()) },
    });
    return { ok: true, message: "Your newsletter topics are saved." };
  }

  // Not confirmed yet (new, pending or unsubscribed): start the usual double opt-in.
  // Account settings show no consent text, so none is stored; the topics are the person's own choice.
  const result = await requestSubscription({ email: user.email, topics: wanted, source: "account", scope: "SELECTED_TOPICS", consentText: null, ip });
  if (!result.ok) {
    return { ok: false, message: result.reason === "rate_limited" ? "Too many attempts. Try again later." : "Check your topics and try again." };
  }
  await prisma.newsletterSubscriber.updateMany({ where: { email: user.email, userId: null }, data: { userId: user.id } });
  return { ok: true, message: "We have sent a confirmation link to your email address. Confirm it to start receiving the newsletter." };
}

export async function unsubscribeAccount(user: { id: string; email: string }, ip: string | null): Promise<NewsletterActionResult> {
  const row = await prisma.newsletterSubscriber.findFirst({
    where: { OR: [{ userId: user.id }, { email: user.email }] },
    select: { id: true },
  });
  if (!row) return { ok: false, message: "You are not subscribed to the newsletter." };
  await unsubscribeByToken(signManageToken(row.id, linkSecret()), { ip, source: "account" });
  return { ok: true, message: "You have been unsubscribed from the newsletter." };
}
