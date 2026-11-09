import { getEmailProvider } from "@/lib/notify/email";
import { getEnv } from "@/lib/config/env";
import { prisma } from "@/lib/db/client";
import {
  DEFAULT_PREFS,
  DIGEST_WINDOW_MS,
  NOTIFICATION_TYPES,
  digestCopy,
  digestDue,
  isSafeHref,
  safeNotificationText,
  shouldEmail,
  type NotificationPrefs,
  type NotificationType,
} from "./rules";

export { DEFAULT_PREFS, DIGEST_WINDOW_MS, NOTIFICATION_TYPES };
export type { NotificationPrefs, NotificationType };

/**
 * In-app notifications (bell and centre) plus email.
 *
 * Rules:
 *  - Notification text is written from fixed templates. It never includes message, offer, quotation or
 *    requirement text written by users, and never includes a contact detail. Email follows the same rule.
 *    safeNotificationText() is a last check: text that looks like a contact detail is replaced.
 *  - In-app notifications are always stored. Email follows the recipient's preferences.
 *  - Message emails are batched. At most one message email per user per DIGEST_WINDOW. Messages that
 *    arrive inside the window wait, and flushMessageDigests() sends them as one digest
 *    (npm run notify:flush, run from a scheduler).
 *  - Notification failures are logged and never break the action that caused them.
 */

/** Requirement matches go to at most this many sellers per requirement post. */
export const MAX_REQUIREMENT_MATCH_RECIPIENTS = 200;

export interface NotifyInput {
  userId: string;
  type: NotificationType;
  /** Short fixed text, e.g. "New enquiry". No user-written text. */
  title: string;
  /** Fixed text for the email body. No user-written text and no contact details. */
  body: string;
  /** App path for the link, e.g. "/conversations/abc". Relative only. */
  href: string;
}

export async function getNotificationPrefs(userId: string): Promise<NotificationPrefs> {
  const row = await prisma.notificationPreference.findUnique({ where: { userId } });
  if (!row) return DEFAULT_PREFS;
  return {
    emailEnabled: row.emailEnabled,
    enquiries: row.enquiries,
    messages: row.messages,
    offersAndQuotes: row.offersAndQuotes,
    requirements: row.requirements,
  };
}

export async function saveNotificationPrefs(userId: string, prefs: NotificationPrefs): Promise<void> {
  await prisma.notificationPreference.upsert({
    where: { userId },
    create: { userId, ...prefs },
    update: { ...prefs },
  });
}

/** Stores the in-app notification and sends email when the preferences allow it. Never throws. */
export async function notify(input: NotifyInput): Promise<void> {
  try {
    const text = safeNotificationText({ title: input.title, body: input.body });
    if (text.replaced) {
      console.warn("[notify] text looked like a contact detail and was replaced", input.type);
    }
    const href = isSafeHref(input.href) ? input.href : "/notifications";

    const row = await prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        payload: { title: text.title, body: text.body, href },
      },
      select: { id: true },
    });

    const prefs = await getNotificationPrefs(input.userId);
    if (!shouldEmail(prefs, input.type)) return;

    if (input.type === NOTIFICATION_TYPES.MESSAGE_RECEIVED) {
      await sendDigestIfDue(input.userId);
      return;
    }
    await sendSingleEmail(input.userId, text.title, text.body, href, [row.id]);
  } catch (error) {
    console.error("[notify] failed", input.type, error);
  }
}

async function recipientEmail(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  return user?.email ?? null;
}

function absoluteUrl(href: string): string {
  return new URL(href, getEnv().APP_URL).toString();
}

async function sendSingleEmail(userId: string, title: string, body: string, href: string, ids: string[]) {
  const to = await recipientEmail(userId);
  if (!to) return;
  await getEmailProvider().send({
    to,
    subject: `Gemstone Selections: ${title}`,
    text: `${body}\n\nOpen it here: ${absoluteUrl(href)}\n\nChange email preferences in your account settings.`,
  });
  await prisma.notification.updateMany({ where: { id: { in: ids } }, data: { emailedAt: new Date() } });
}

async function lastMessageEmailedAt(userId: string): Promise<Date | null> {
  const last = await prisma.notification.findFirst({
    where: { userId, type: NOTIFICATION_TYPES.MESSAGE_RECEIVED, emailedAt: { not: null } },
    orderBy: { emailedAt: "desc" },
    select: { emailedAt: true },
  });
  return last?.emailedAt ?? null;
}

/** Sends a message digest now, unless one was sent inside the window. Pending rows wait for the flush. */
async function sendDigestIfDue(userId: string, now = new Date()): Promise<void> {
  if (!digestDue(await lastMessageEmailedAt(userId), now)) return;
  await sendMessageDigest(userId, now);
}

/** Emails the pending message notifications for one user as one digest. Returns how many rows it covered. */
async function sendMessageDigest(userId: string, now = new Date()): Promise<number> {
  const pendingWhere = { userId, type: NOTIFICATION_TYPES.MESSAGE_RECEIVED, emailedAt: null };
  const pending = await prisma.notification.findMany({
    where: pendingWhere,
    orderBy: { createdAt: "asc" },
    take: 200,
    select: { id: true },
  });
  if (pending.length === 0) return 0;

  const to = await recipientEmail(userId);
  if (to) {
    const total = await prisma.notification.count({ where: pendingWhere });
    const copy = digestCopy(total, absoluteUrl("/conversations"));
    await getEmailProvider().send({ to, subject: copy.subject, text: copy.text });
  }
  await prisma.notification.updateMany({
    where: { id: { in: pending.map((p) => p.id) } },
    data: { emailedAt: now },
  });
  return pending.length;
}

/**
 * Sends one digest for each user with pending message emails whose window has passed.
 * Run from a scheduler (npm run notify:flush). Returns the number of digests sent.
 */
export async function flushMessageDigests(now = new Date()): Promise<number> {
  const users = await prisma.notification.findMany({
    where: { type: NOTIFICATION_TYPES.MESSAGE_RECEIVED, emailedAt: null },
    distinct: ["userId"],
    select: { userId: true },
    take: 500,
  });
  let sent = 0;
  for (const { userId } of users) {
    const prefs = await getNotificationPrefs(userId);
    if (!shouldEmail(prefs, NOTIFICATION_TYPES.MESSAGE_RECEIVED)) continue;
    if (!digestDue(await lastMessageEmailedAt(userId), now)) continue;
    try {
      sent += (await sendMessageDigest(userId, now)) > 0 ? 1 : 0;
    } catch (error) {
      console.error("[notify] digest failed", userId, error);
    }
  }
  return sent;
}

/**
 * Tells approved sellers in the requirement's category that a buyer posted it. Fixed text only: the
 * requirement's notes and gemstone type are buyer-written and are never included. Never throws.
 */
export async function notifyRequirementMatches(input: {
  requirementId: string;
  buyerId: string;
  categoryId: string | null;
}): Promise<number> {
  if (!input.categoryId) return 0;
  try {
    const sellers = await prisma.sellerProfile.findMany({
      where: {
        approvalStatus: "APPROVED",
        user: { status: "ACTIVE", id: { not: input.buyerId } },
        categories: { some: { id: input.categoryId } },
      },
      select: { userId: true },
      orderBy: { id: "asc" },
      take: MAX_REQUIREMENT_MATCH_RECIPIENTS,
    });
    for (const seller of sellers) {
      await notify({
        userId: seller.userId,
        type: NOTIFICATION_TYPES.REQUIREMENT_MATCH,
        title: "New buyer requirement",
        body: "A buyer has posted a requirement in a category you sell in. Open the requirements board to see it and respond.",
        href: "/seller/requirements",
      });
    }
    return sellers.length;
  } catch (error) {
    console.error("[notify] requirement matches failed", input.requirementId, error);
    return 0;
  }
}

/** Tells the buyer that a seller responded to their requirement. Never throws. */
export async function notifyRequirementResponse(input: {
  buyerId: string;
  requirementId: string;
  conversationId: string;
}): Promise<void> {
  await notify({
    userId: input.buyerId,
    type: NOTIFICATION_TYPES.REQUIREMENT_RESPONSE,
    title: "New response to your requirement",
    body: "A seller has responded to your requirement. Open the conversation to read the reply.",
    href: `/conversations/${input.conversationId}`,
  });
}

export async function unreadNotificationCount(userId: string): Promise<number> {
  return prisma.notification.count({ where: { userId, readAt: null } });
}

export async function markNotificationsRead(userId: string, ids?: string[]): Promise<void> {
  await prisma.notification.updateMany({
    where: { userId, readAt: null, ...(ids ? { id: { in: ids } } : {}) },
    data: { readAt: new Date() },
  });
}
