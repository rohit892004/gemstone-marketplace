import { getEmailProvider } from "@/lib/notify/email";
import { getEnv } from "@/lib/config/env";
import { prisma } from "@/lib/db/client";

/**
 * In-app notifications (bell and centre) plus email.
 *
 * Rules:
 *  - Notification text is written from fixed templates. It never includes message, offer, quotation or
 *    requirement text written by users, and never includes a contact detail. Email follows the same rule.
 *  - In-app notifications are always stored. Email follows the recipient's preferences.
 *  - Message emails are batched. At most one message email per user per DIGEST_WINDOW. Messages that
 *    arrive inside the window wait, and flushMessageDigests() sends them as one digest.
 *  - Notification failures are logged and never break the action that caused them.
 */

export const NOTIFICATION_TYPES = {
  ENQUIRY_RECEIVED: "enquiry.received",
  MESSAGE_RECEIVED: "message.received",
  OFFER_RECEIVED: "offer.received",
  OFFER_RESPONDED: "offer.responded",
  QUOTATION_RECEIVED: "quotation.received",
  QUOTATION_RESPONDED: "quotation.responded",
  REQUIREMENT_MATCH: "requirement.match",
  REQUIREMENT_RESPONSE: "requirement.response",
} as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[keyof typeof NOTIFICATION_TYPES];

export const DIGEST_WINDOW_MS = 10 * 60 * 1000;

export interface NotificationPrefs {
  emailEnabled: boolean;
  enquiries: boolean;
  messages: boolean;
  offersAndQuotes: boolean;
  requirements: boolean;
}

export const DEFAULT_PREFS: NotificationPrefs = {
  emailEnabled: true,
  enquiries: true,
  messages: true,
  offersAndQuotes: true,
  requirements: true,
};

type PrefCategory = Exclude<keyof NotificationPrefs, "emailEnabled">;

function categoryFor(type: string): PrefCategory {
  if (type.startsWith("enquiry.")) return "enquiries";
  if (type.startsWith("message.")) return "messages";
  if (type.startsWith("offer.") || type.startsWith("quotation.")) return "offersAndQuotes";
  return "requirements";
}

export interface NotifyInput {
  userId: string;
  type: NotificationType;
  /** Short fixed text, e.g. "New enquiry on Blue Sapphire 5.2 ct". No user-written text. */
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
    const row = await prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        payload: { title: input.title, body: input.body, href: input.href },
      },
      select: { id: true },
    });

    const prefs = await getNotificationPrefs(input.userId);
    const category = categoryFor(input.type);
    if (!prefs.emailEnabled || !prefs[category]) return;

    if (input.type === NOTIFICATION_TYPES.MESSAGE_RECEIVED) {
      await sendDigestIfDue(input.userId);
      return;
    }
    await sendSingleEmail(input.userId, input.title, input.body, input.href, [row.id]);
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

/** Sends a message digest now, unless one was sent inside the window. Pending rows wait for the flush. */
async function sendDigestIfDue(userId: string, now = new Date()): Promise<void> {
  const last = await prisma.notification.findFirst({
    where: { userId, type: NOTIFICATION_TYPES.MESSAGE_RECEIVED, emailedAt: { not: null } },
    orderBy: { emailedAt: "desc" },
    select: { emailedAt: true },
  });
  if (last?.emailedAt && now.getTime() - last.emailedAt.getTime() < DIGEST_WINDOW_MS) return;
  await sendMessageDigest(userId, now);
}

async function sendMessageDigest(userId: string, now = new Date()): Promise<number> {
  const pending = await prisma.notification.findMany({
    where: { userId, type: NOTIFICATION_TYPES.MESSAGE_RECEIVED, emailedAt: null },
    orderBy: { createdAt: "asc" },
    take: 200,
    select: { id: true },
  });
  if (pending.length === 0) return 0;

  const to = await recipientEmail(userId);
  if (to) {
    const count = pending.length;
    await getEmailProvider().send({
      to,
      subject: "Gemstone Selections: new messages",
      text:
        `You have ${count} new ${count === 1 ? "message" : "messages"} on Gemstone Selections.\n\n` +
        `Open your conversations here: ${absoluteUrl("/conversations")}\n\n` +
        "Messages stay on the platform. Change email preferences in your account settings.",
    });
  }
  await prisma.notification.updateMany({
    where: { id: { in: pending.map((p) => p.id) } },
    data: { emailedAt: now },
  });
  return pending.length;
}

/**
 * Sends one digest for each user with pending message emails whose window has passed.
 * Call from a scheduled job or a maintenance script. Returns the number of digests sent.
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
    if (!prefs.emailEnabled || !prefs.messages) continue;
    const last = await prisma.notification.findFirst({
      where: { userId, type: NOTIFICATION_TYPES.MESSAGE_RECEIVED, emailedAt: { not: null } },
      orderBy: { emailedAt: "desc" },
      select: { emailedAt: true },
    });
    if (last?.emailedAt && now.getTime() - last.emailedAt.getTime() < DIGEST_WINDOW_MS) continue;
    try {
      sent += (await sendMessageDigest(userId, now)) > 0 ? 1 : 0;
    } catch (error) {
      console.error("[notify] digest failed", userId, error);
    }
  }
  return sent;
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
