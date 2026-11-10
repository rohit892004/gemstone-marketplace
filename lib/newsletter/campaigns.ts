import { z } from "zod";
import { recordAudit } from "@/lib/audit/audit";
import { AuditAction } from "@/lib/audit/actions";
import { MARKDOWN_MAX_CHARS, markdownToPlainText } from "@/lib/content/markdown";
import { prisma } from "@/lib/db/client";
import { runExclusive } from "@/lib/jobs/lock";
import { getEmailProvider } from "@/lib/notify/email";
import { linkSecret } from "./service";
import { mayReceive, type SubscriberSnapshot } from "./state";
import { manageUrl, newsletterFooter, unsubscribeHeaders, unsubscribeUrl } from "./templates";
import { signManageToken } from "./tokens";
import { NEWSLETTER_TOPICS, normaliseTopics } from "./topics";

/**
 * Campaign composer rules and the batch sender. Campaigns are Markdown, sent as plain text with the
 * newsletter footer and one-click unsubscribe headers. Every recipient is re-checked at send time.
 */

export const SEND_BATCH_SIZE = 50;
export const MAX_SEND_ATTEMPTS = 3;
export const CAMPAIGN_JOB_LOCK = "newsletter:campaigns";

export const campaignInputSchema = z.object({
  subject: z.string().trim().min(1, "Enter a subject.").max(150, "Keep the subject under 150 characters."),
  preheader: z.string().trim().max(200, "Keep the preheader under 200 characters.").optional().transform((v) => v || null),
  body: z
    .string()
    .trim()
    .min(1, "Write the message body.")
    .max(MARKDOWN_MAX_CHARS, `The body is longer than ${MARKDOWN_MAX_CHARS} characters.`),
  topics: z.array(z.enum(NEWSLETTER_TOPICS)).min(1, "Choose at least one topic."),
});
export type CampaignInput = z.infer<typeof campaignInputSchema>;

/** Parses submitted form values into a campaign input. Unknown topics are dropped. */
export function parseCampaignInput(raw: {
  subject: unknown;
  preheader: unknown;
  body: unknown;
  topics: unknown;
}): { ok: true; value: CampaignInput } | { ok: false; error: string } {
  const topics = Array.isArray(raw.topics) ? raw.topics.map(String) : typeof raw.topics === "string" ? [raw.topics] : [];
  const parsed = campaignInputSchema.safeParse({
    subject: typeof raw.subject === "string" ? raw.subject : "",
    preheader: typeof raw.preheader === "string" ? raw.preheader : undefined,
    body: typeof raw.body === "string" ? raw.body : "",
    topics: normaliseTopics(topics),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form." };
  return { ok: true, value: parsed.data };
}

/** Why a campaign cannot be scheduled for `at`, or null when it can. */
export function scheduleProblem(at: Date | null, now: Date): string | null {
  if (!at || Number.isNaN(at.getTime())) return "Pick a valid date and time (UTC).";
  if (at.getTime() <= now.getTime()) return "The send time must be in the future.";
  return null;
}

export interface RecipientCandidate extends SubscriberSnapshot {
  id: string;
  email: string;
}

export type RecipientDecision = { send: true } | { send: false; reason: "not_confirmed" | "suppressed" | "no_matching_topic" };

/** Pure send decision for one subscriber. Used at snapshot time and again just before each send. */
export function recipientDecision(
  subscriber: SubscriberSnapshot,
  target: readonly string[],
  suppressed: boolean,
): RecipientDecision {
  const check = mayReceive(subscriber, target, suppressed);
  return check.ok ? { send: true } : { send: false, reason: check.reason };
}

/** Subscriber ids that should receive a campaign aimed at `target`. Suppressed addresses are excluded. */
export function selectRecipients(
  candidates: readonly RecipientCandidate[],
  target: readonly string[],
  suppressedEmails: ReadonlySet<string>,
): string[] {
  return candidates
    .filter((c) => recipientDecision(c, target, suppressedEmails.has(c.email)).send)
    .map((c) => c.id);
}

/** Plain-text message body for a campaign: the Markdown as plain text, then the footer. */
export function campaignText(body: string, token: string): string {
  return markdownToPlainText(body) + newsletterFooter({ manageUrl: manageUrl(token), unsubscribeUrl: unsubscribeUrl(token) });
}

export class CampaignStateError extends Error {}

const EDITABLE = ["DRAFT", "SCHEDULED"] as const;

export async function createCampaign(input: CampaignInput, actorId: string): Promise<{ id: string }> {
  const campaign = await prisma.newsletterCampaign.create({
    data: {
      subject: input.subject,
      preheader: input.preheader,
      body: input.body,
      topics: input.topics,
      status: "DRAFT",
      createdById: actorId,
    },
    select: { id: true },
  });
  await recordAudit({
    action: AuditAction.NEWSLETTER_CAMPAIGN_CREATED,
    actorId,
    entityType: "NewsletterCampaign",
    entityId: campaign.id,
    meta: { topics: input.topics.join(",") },
  });
  return campaign;
}

/** Edits a DRAFT or SCHEDULED campaign. Sent, sending and cancelled campaigns are read-only. */
export async function updateCampaign(id: string, input: CampaignInput): Promise<void> {
  const result = await prisma.newsletterCampaign.updateMany({
    where: { id, status: { in: [...EDITABLE] } },
    data: { subject: input.subject, preheader: input.preheader, body: input.body, topics: input.topics },
  });
  if (result.count === 0) throw new CampaignStateError("This campaign can no longer be edited.");
}

/** Sets (or moves) the send time of a DRAFT or SCHEDULED campaign. The time must be in the future. */
export async function scheduleCampaign(id: string, at: Date, now: Date = new Date()): Promise<void> {
  const problem = scheduleProblem(at, now);
  if (problem) throw new CampaignStateError(problem);
  const result = await prisma.newsletterCampaign.updateMany({
    where: { id, status: { in: [...EDITABLE] } },
    data: { status: "SCHEDULED", scheduledFor: at },
  });
  if (result.count === 0) throw new CampaignStateError("This campaign can no longer be scheduled.");
}

/** Cancels a DRAFT or SCHEDULED campaign. Once sending has started it cannot be cancelled. */
export async function cancelCampaign(id: string, actorId: string): Promise<void> {
  const result = await prisma.newsletterCampaign.updateMany({
    where: { id, status: { in: [...EDITABLE] } },
    data: { status: "CANCELLED" },
  });
  if (result.count === 0) throw new CampaignStateError("Only draft or scheduled campaigns can be cancelled.");
  await recordAudit({ action: AuditAction.NEWSLETTER_CAMPAIGN_CANCELLED, actorId, entityType: "NewsletterCampaign", entityId: id });
}

/**
 * Sends a test copy to the admin's own address. Does not change the campaign status or the send list.
 * If the admin is also a subscriber, their real preference links are used. Otherwise the links in the
 * test are not valid and are labelled as a preview.
 */
export async function sendTestCampaign(id: string, admin: { id: string; email: string }): Promise<void> {
  const campaign = await prisma.newsletterCampaign.findUnique({
    where: { id },
    select: { subject: true, body: true },
  });
  if (!campaign) throw new CampaignStateError("Campaign not found.");
  const subscriber = await prisma.newsletterSubscriber.findUnique({ where: { email: admin.email }, select: { id: true } });
  const token = signManageToken(subscriber?.id ?? "preview", linkSecret());
  await getEmailProvider().send({
    to: admin.email,
    subject: `[Test] ${campaign.subject}`,
    text: `This is a test. Links below are ${subscriber ? "live" : "not valid, because this address is not a subscriber"}.\n\n` + campaignText(campaign.body, token),
    headers: subscriber ? unsubscribeHeaders(token) : undefined,
  });
  await prisma.newsletterCampaign.update({ where: { id }, data: { testSentAt: new Date() } });
  await recordAudit({ action: AuditAction.NEWSLETTER_CAMPAIGN_TEST_SENT, actorId: admin.id, entityType: "NewsletterCampaign", entityId: id });
}

export interface DueRunSummary {
  campaigns: number;
  sent: number;
  failed: number;
  skipped: number;
  retrying: number;
}

/**
 * Worker entry point. Starts due SCHEDULED campaigns, snapshots their recipients, sends one batch at a time,
 * and finishes campaigns with no QUEUED rows left. Safe to call on every tick. Returns { ran: false } when
 * another process holds the lock.
 */
export async function processDueCampaigns(now: Date = new Date()): Promise<{ ran: true; value: DueRunSummary } | { ran: false }> {
  return runExclusive(CAMPAIGN_JOB_LOCK, () => runDueCampaigns(now));
}

async function runDueCampaigns(now: Date): Promise<DueRunSummary> {
  const summary: DueRunSummary = { campaigns: 0, sent: 0, failed: 0, skipped: 0, retrying: 0 };

  const due = await prisma.newsletterCampaign.findMany({
    where: { status: "SCHEDULED", scheduledFor: { lte: now } },
    select: { id: true },
    orderBy: { scheduledFor: "asc" },
  });
  for (const row of due) {
    // Conditional claim: only one run moves the campaign to SENDING.
    await prisma.newsletterCampaign.updateMany({
      where: { id: row.id, status: "SCHEDULED", scheduledFor: { lte: now } },
      data: { status: "SENDING", startedAt: now },
    });
  }

  const sending = await prisma.newsletterCampaign.findMany({
    where: { status: "SENDING" },
    select: { id: true },
    orderBy: { startedAt: "asc" },
  });
  for (const row of sending) {
    summary.campaigns += 1;
    const outcome = await sendCampaignBatches(row.id, now);
    summary.sent += outcome.sent;
    summary.failed += outcome.failed;
    summary.skipped += outcome.skipped;
    summary.retrying += outcome.retrying;
  }
  return summary;
}

/** Creates the QUEUED rows once. A campaign's recipient list is fixed at snapshot time. */
async function snapshotRecipients(campaignId: string): Promise<void> {
  const existing = await prisma.newsletterSend.count({ where: { campaignId } });
  if (existing > 0) return;

  const campaign = await prisma.newsletterCampaign.findUniqueOrThrow({ where: { id: campaignId }, select: { topics: true } });
  const candidates = await prisma.newsletterSubscriber.findMany({
    where: { status: "CONFIRMED", topics: { hasSome: campaign.topics } },
    select: { id: true, email: true, status: true, topics: true },
  });
  const suppressed = await suppressedSet(candidates.map((c) => c.email));

  const rows = candidates.map((c) => {
    const decision = recipientDecision(c, campaign.topics, suppressed.has(c.email));
    return { campaignId, subscriberId: c.id, status: decision.send ? ("QUEUED" as const) : ("SKIPPED" as const), lastError: decision.send ? null : decision.reason };
  });
  if (rows.length > 0) await prisma.newsletterSend.createMany({ data: rows, skipDuplicates: true });
}

async function suppressedSet(emails: string[]): Promise<Set<string>> {
  if (emails.length === 0) return new Set();
  const hits = await prisma.emailSuppression.findMany({ where: { email: { in: emails } }, select: { email: true } });
  return new Set(hits.map((h) => h.email));
}

interface BatchOutcome {
  sent: number;
  failed: number;
  skipped: number;
  retrying: number;
}

/**
 * Sends the QUEUED rows of one campaign. Each row is attempted once per run, in id order, so a failing
 * row cannot loop inside the run. Rows that fail with attempts left stay QUEUED for the next run.
 */
async function sendCampaignBatches(campaignId: string, now: Date): Promise<BatchOutcome> {
  await snapshotRecipients(campaignId);
  const campaign = await prisma.newsletterCampaign.findUniqueOrThrow({
    where: { id: campaignId },
    select: { subject: true, body: true, topics: true },
  });
  const outcome: BatchOutcome = { sent: 0, failed: 0, skipped: 0, retrying: 0 };
  const provider = getEmailProvider();
  let cursor: string | undefined;

  for (;;) {
    const batch = await prisma.newsletterSend.findMany({
      where: { campaignId, status: "QUEUED", ...(cursor ? { id: { gt: cursor } } : {}) },
      orderBy: { id: "asc" },
      take: SEND_BATCH_SIZE,
      select: {
        id: true,
        attempts: true,
        subscriber: { select: { id: true, email: true, status: true, topics: true } },
      },
    });
    if (batch.length === 0) break;
    cursor = batch[batch.length - 1].id;

    const suppressed = await suppressedSet(batch.map((b) => b.subscriber.email));
    for (const row of batch) {
      const subscriber = row.subscriber;
      const decision = recipientDecision(subscriber, campaign.topics, suppressed.has(subscriber.email));
      if (!decision.send) {
        await prisma.newsletterSend.update({ where: { id: row.id }, data: { status: "SKIPPED", lastError: decision.reason } });
        outcome.skipped += 1;
        continue;
      }

      const token = signManageToken(subscriber.id, linkSecret());
      try {
        await provider.send({
          to: subscriber.email,
          subject: campaign.subject,
          text: campaignText(campaign.body, token),
          headers: unsubscribeHeaders(token),
        });
        await prisma.newsletterSend.update({
          where: { id: row.id },
          data: { status: "SENT", attempts: { increment: 1 }, sentAt: now, lastError: null },
        });
        outcome.sent += 1;
      } catch (error) {
        const attempts = row.attempts + 1;
        const message = error instanceof Error ? error.message.slice(0, 300) : "send failed";
        const exhausted = attempts >= MAX_SEND_ATTEMPTS;
        await prisma.newsletterSend.update({
          where: { id: row.id },
          data: { status: exhausted ? "FAILED" : "QUEUED", attempts, lastError: message },
        });
        if (exhausted) outcome.failed += 1;
        else outcome.retrying += 1;
      }
    }
  }

  const queued = await prisma.newsletterSend.count({ where: { campaignId, status: "QUEUED" } });
  if (queued === 0) await finishCampaign(campaignId, now);
  return outcome;
}

/** Writes the final counts and marks the campaign SENT. Conditional on SENDING, so it runs once. */
async function finishCampaign(campaignId: string, now: Date): Promise<void> {
  const groups = await prisma.newsletterSend.groupBy({ by: ["status"], where: { campaignId }, _count: { _all: true } });
  const count = (status: string) => groups.find((g) => g.status === status)?._count._all ?? 0;
  const sentCount = count("SENT");
  const failedCount = count("FAILED");
  const skippedCount = count("SKIPPED");
  const recipientCount = sentCount + failedCount + skippedCount;
  const result = await prisma.newsletterCampaign.updateMany({
    where: { id: campaignId, status: "SENDING" },
    data: { status: "SENT", sentAt: now, recipientCount, sentCount, failedCount, skippedCount },
  });
  if (result.count === 1) {
    await recordAudit({
      action: AuditAction.NEWSLETTER_CAMPAIGN_SENT,
      actorId: null,
      entityType: "NewsletterCampaign",
      entityId: campaignId,
      meta: { sent: sentCount, failed: failedCount, skipped: skippedCount },
    });
  }
}
