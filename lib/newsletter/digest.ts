import { appUrl } from "@/lib/config/app-url";
import { getEnv } from "@/lib/config/env";
import { prisma } from "@/lib/db/client";
import { runExclusive } from "@/lib/jobs/lock";
import { getEmailProvider } from "@/lib/notify/email";
import { linkSecret } from "./service";
import { mayReceive } from "./state";
import { newsletterFooter, manageUrl, unsubscribeHeaders, unsubscribeUrl } from "./templates";
import { signManageToken } from "./tokens";
import { TOPIC_LABELS, type NewsletterTopicName } from "./topics";

/**
 * Weekly digest. One period per ISO week (e.g. "2026-W46"). The digest for a week is due from Monday
 * 03:30 UTC of that week. A NewsletterDigestRun row, keyed by the period, is created before any mail goes
 * out, so a second run for the same week does nothing.
 */

export const DIGEST_LOOKBACK_DAYS = 7;
const DIGEST_HOUR_UTC = 3;
const DIGEST_MINUTE_UTC = 30;
const DAY_MS = 24 * 60 * 60 * 1000;
export const DIGEST_LOCK = "newsletter:digest";
const PAGE_SIZE = 200;

/** Monday 00:00 UTC of the ISO week containing `now`. */
function mondayUtc(now: Date): Date {
  const day = now.getUTCDay() || 7; // Sunday counts as day 7 (ISO)
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (day - 1)));
}

/** ISO week key for `now`, in UTC. The year is the ISO week-numbering year. */
export function isoWeekKey(now: Date): string {
  const thursday = new Date(mondayUtc(now).getTime() + 3 * DAY_MS);
  const year = thursday.getUTCFullYear();
  const yearStart = Date.UTC(year, 0, 1);
  const week = Math.floor((thursday.getTime() - yearStart) / DAY_MS / 7) + 1;
  return `${year}-W${String(week).padStart(2, "0")}`;
}

/** When the digest for the ISO week containing `now` becomes due: that week's Monday 03:30 UTC. */
export function digestDueAt(now: Date): Date {
  return new Date(mondayUtc(now).getTime() + DIGEST_HOUR_UTC * 60 * 60 * 1000 + DIGEST_MINUTE_UTC * 60 * 1000);
}

/** True once this week's digest time has passed. Before it, nothing is due for this week. */
export function digestDue(now: Date): boolean {
  return now.getTime() >= digestDueAt(now).getTime();
}

export type DigestKind = "EDUCATION" | "GUIDE" | "RESEARCH" | "NEWS" | "LISTING";

export interface DigestItem {
  topic: NewsletterTopicName;
  kind: DigestKind;
  title: string;
  url: string;
}

/** Which article types feed which topic. PLATFORM_UPDATES has no automatic items. */
export const ARTICLE_TYPES_BY_TOPIC: Partial<Record<NewsletterTopicName, readonly DigestKind[]>> = {
  EDUCATION: ["EDUCATION", "GUIDE", "RESEARCH"],
  MARKET_NEWS: ["NEWS"],
};

export interface DigestSource {
  articles: { title: string; slug: string; type: DigestKind }[];
  gemstones: { title: string; slug: string }[];
}

/** Turns the week's content into digest items, grouped by topic. Pure. */
export function digestItemsFromSource(source: DigestSource): DigestItem[] {
  const items: DigestItem[] = [];
  for (const article of source.articles) {
    for (const [topic, kinds] of Object.entries(ARTICLE_TYPES_BY_TOPIC) as [NewsletterTopicName, readonly DigestKind[]][]) {
      if (!kinds.includes(article.type)) continue;
      const path = article.type === "NEWS" ? `/news/${encodeURIComponent(article.slug)}` : `/learn/${encodeURIComponent(article.slug)}`;
      items.push({ topic, kind: article.type, title: article.title, url: path });
    }
  }
  for (const gemstone of source.gemstones) {
    items.push({ topic: "NEW_LISTINGS", kind: "LISTING", title: gemstone.title, url: `/gemstones/${encodeURIComponent(gemstone.slug)}` });
  }
  return items;
}

/** The items a subscriber gets: only topics they chose, and only topics that have items this week. */
export function itemsForSubscriber(items: readonly DigestItem[], subscriberTopics: readonly string[]): Map<NewsletterTopicName, DigestItem[]> {
  const sections = new Map<NewsletterTopicName, DigestItem[]>();
  for (const item of items) {
    if (!subscriberTopics.includes(item.topic)) continue;
    const list = sections.get(item.topic) ?? [];
    list.push(item);
    sections.set(item.topic, list);
  }
  return sections;
}

/** Plain-text digest body for one subscriber. Returns null when there is nothing to send. */
export function digestText(sections: Map<NewsletterTopicName, DigestItem[]>, token: string): string | null {
  if (sections.size === 0) return null;
  const lines = ["Your Gemstone Selections digest for the past week.", ""];
  for (const [topic, items] of sections) {
    lines.push(TOPIC_LABELS[topic], "");
    for (const item of items) lines.push(`- ${item.title}: ${absolute(item.url)}`);
    lines.push("");
  }
  lines.push(newsletterFooter({ manageUrl: manageUrl(token), unsubscribeUrl: unsubscribeUrl(token) }));
  return lines.join("\n");
}

function absolute(path: string): string {
  return appUrl(path);
}

/** Loads the week's content. Demo rows are excluded in production so demo data never reaches subscribers. */
async function loadDigestSource(now: Date): Promise<DigestSource> {
  const since = new Date(now.getTime() - DIGEST_LOOKBACK_DAYS * DAY_MS);
  const skipDemo = getEnv().NODE_ENV === "production";
  const [articles, gemstones] = await Promise.all([
    prisma.article.findMany({
      where: {
        status: "PUBLISHED",
        publishedAt: { gte: since, lte: now },
        ...(skipDemo ? { isDemo: false } : {}),
      },
      select: { title: true, slug: true, type: true },
      orderBy: { publishedAt: "desc" },
    }),
    prisma.gemstone.findMany({
      where: {
        status: "PUBLISHED",
        publishedAt: { gte: since, lte: now },
        ...(skipDemo ? { isDemo: false } : {}),
      },
      select: { title: true, slug: true },
      orderBy: { publishedAt: "desc" },
    }),
  ]);
  return { articles, gemstones };
}

export type DigestOutcome =
  | { status: "not_due" }
  | { status: "already_sent" }
  | { status: "sent"; periodKey: string; recipients: number; failed: number };

/** Worker entry point. Safe to call on every tick. */
export async function sendWeeklyDigestIfDue(now: Date = new Date()): Promise<{ ran: true; value: DigestOutcome } | { ran: false }> {
  return runExclusive(DIGEST_LOCK, () => runDigest(now));
}

async function runDigest(now: Date): Promise<DigestOutcome> {
  if (!digestDue(now)) return { status: "not_due" };
  const periodKey = isoWeekKey(now);
  if (await prisma.newsletterDigestRun.findUnique({ where: { periodKey }, select: { id: true } })) {
    return { status: "already_sent" };
  }
  // Create the run first. The unique key turns a concurrent second run into a no-op.
  try {
    await prisma.newsletterDigestRun.create({ data: { periodKey, recipientCount: 0 } });
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") return { status: "already_sent" };
    throw error;
  }

  const items = digestItemsFromSource(await loadDigestSource(now));
  const itemTopics = [...new Set(items.map((i) => i.topic))];
  const provider = getEmailProvider();
  let recipients = 0;
  let failed = 0;
  let cursor: string | undefined;

  if (itemTopics.length > 0) {
    for (;;) {
      const page = await prisma.newsletterSubscriber.findMany({
        where: { status: "CONFIRMED", topics: { hasSome: itemTopics } },
        orderBy: { id: "asc" },
        take: PAGE_SIZE,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        select: { id: true, email: true, status: true, topics: true },
      });
      if (page.length === 0) break;
      cursor = page[page.length - 1].id;

      const suppressed = new Set(
        (await prisma.emailSuppression.findMany({ where: { email: { in: page.map((p) => p.email) } }, select: { email: true } })).map((s) => s.email),
      );
      for (const subscriber of page) {
        const sections = itemsForSubscriber(items, subscriber.topics);
        const target = [...sections.keys()];
        if (!mayReceive(subscriber, target, suppressed.has(subscriber.email)).ok) continue;
        const token = signManageToken(subscriber.id, linkSecret());
        const text = digestText(sections, token);
        if (!text) continue;
        try {
          await provider.send({
            to: subscriber.email,
            subject: `Gemstone Selections digest, ${periodKey}`,
            text,
            headers: unsubscribeHeaders(token),
          });
          recipients += 1;
        } catch (error) {
          failed += 1;
          console.error("[newsletter] digest send failed", periodKey, error);
        }
      }
    }
  }

  await prisma.newsletterDigestRun.update({ where: { periodKey }, data: { recipientCount: recipients } });
  return { status: "sent", periodKey, recipients, failed };
}
