import { recordAudit } from "@/lib/audit/audit";
import { AuditAction } from "@/lib/audit/actions";
import { appUrl } from "@/lib/config/app-url";
import { getEnv } from "@/lib/config/env";
import { prisma } from "@/lib/db/client";
import { getEmailProvider } from "@/lib/notify/email";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import { confirmExpiry, confirmOutcome, type ConfirmOutcome, topicChangeProblem } from "./state";
import { consentTextFor } from "./messages";
import { alreadySubscribedEmail, confirmationEmail, manageUrl } from "./templates";
import { generateConfirmToken, hashIp, hashToken, normaliseEmail, signManageToken, verifyManageToken } from "./tokens";
import { type ConsentScope, type NewsletterTopicName, NEWSLETTER_TOPICS, normaliseTopics } from "./topics";

/**
 * Newsletter sign-up, double opt-in, preferences and unsubscribe. Every public entry point gives the same
 * answer whether or not the address exists, so the forms cannot be used to find subscribers.
 */

const DEV_LINK_SECRET = "dev-only-newsletter-link-secret-change-me";

/** The key behind signed links. AUTH_SECRET in production (required by the env check). */
export function linkSecret(): string {
  const { AUTH_SECRET, NODE_ENV } = getEnv();
  if (AUTH_SECRET) return AUTH_SECRET;
  if (NODE_ENV === "production") throw new Error("AUTH_SECRET is required to sign newsletter links.");
  return DEV_LINK_SECRET;
}

export type SubscribeResult =
  | { ok: true }
  | { ok: false; reason: "invalid_email" | "no_topic" | "rate_limited" };

const SIGNUP_IP_LIMIT = 10;
const SIGNUP_EMAIL_LIMIT = 3;
const HOUR = 60 * 60;

/**
 * Starts a sign-up. For a new or pending address this stores a pending subscriber and emails a confirmation link.
 * For an address that is already confirmed it emails the preferences link instead. Suppressed addresses get
 * nothing. The caller gets { ok: true } in all three cases, so nothing reveals which one applied.
 */
export async function requestSubscription(input: {
  email: string;
  topics: string[];
  source: string;
  /** "ALL_TOPICS" for the footer Subscribe button (every topic); "SELECTED_TOPICS" otherwise. Default: selected. */
  scope?: ConsentScope;
  /** The exact consent text the person was shown. Defaults to the text for the scope; null when none was shown. */
  consentText?: string | null;
  ip: string | null;
  now?: Date;
}): Promise<SubscribeResult> {
  const now = input.now ?? new Date();
  const email = normaliseEmail(input.email);
  if (!email) return { ok: false, reason: "invalid_email" };
  const scope: ConsentScope = input.scope ?? "SELECTED_TOPICS";
  const consentText = input.consentText === undefined ? consentTextFor(scope) : input.consentText;
  const topics = scope === "ALL_TOPICS" ? [...NEWSLETTER_TOPICS] : normaliseTopics(input.topics);
  if (topics.length === 0) return { ok: false, reason: "no_topic" };

  const ipLimit = await consumeRateLimit({ key: `newsletter:ip:${input.ip ?? "unknown"}`, limit: SIGNUP_IP_LIMIT, windowSeconds: HOUR });
  const emailLimit = await consumeRateLimit({ key: `newsletter:email:${email}`, limit: SIGNUP_EMAIL_LIMIT, windowSeconds: HOUR });
  if (!ipLimit.allowed || !emailLimit.allowed) return { ok: false, reason: "rate_limited" };

  const suppressed = await prisma.emailSuppression.findUnique({ where: { email }, select: { email: true } });
  if (suppressed) return { ok: true };

  const existing = await prisma.newsletterSubscriber.findUnique({ where: { email }, select: { id: true, status: true } });
  if (existing?.status === "CONFIRMED") {
    await getEmailProvider()
      .send(alreadySubscribedEmail({ to: email, manageUrl: manageUrl(signManageToken(existing.id, linkSecret())) }))
      .catch((error: unknown) => console.error("[newsletter] already-subscribed email failed", error));
    return { ok: true };
  }

  const token = generateConfirmToken();
  const subscriber = await prisma.newsletterSubscriber.upsert({
    where: { email },
    create: {
      email,
      status: "PENDING",
      topics,
      source: input.source,
      confirmTokenHash: hashToken(token),
      confirmExpiresAt: confirmExpiry(now),
    },
    update: {
      status: "PENDING",
      topics,
      source: input.source,
      confirmTokenHash: hashToken(token),
      confirmExpiresAt: confirmExpiry(now),
      unsubscribedAt: null,
    },
    select: { id: true },
  });
  await prisma.newsletterConsent.create({
    data: {
      subscriberId: subscriber.id,
      action: "REQUESTED",
      topics,
      source: input.source,
      scope,
      consentText,
      ipHash: hashIp(input.ip, linkSecret()),
    },
  });
  await getEmailProvider()
    .send(confirmationEmail({ to: email, confirmUrl: appUrl(`/newsletter/confirm?token=${encodeURIComponent(token)}`) }))
    .catch((error: unknown) => console.error("[newsletter] confirmation email failed", error));
  return { ok: true };
}

/** Looks up a pending confirmation for the confirm page. Does not consume the link. */
export async function pendingConfirmation(token: string, now: Date = new Date()): Promise<ConfirmOutcome> {
  const row = await prisma.newsletterSubscriber.findUnique({
    where: { confirmTokenHash: hashToken(token) },
    select: { status: true, confirmExpiresAt: true },
  });
  return confirmOutcome(row, now);
}

/**
 * Completes double opt-in. Called from a POST, so mail scanners that open links cannot confirm an address.
 * The update is conditional on the pending status, so a double submit confirms once.
 */
export async function confirmSubscription(token: string, input: { ip: string | null; now?: Date }): Promise<ConfirmOutcome> {
  const now = input.now ?? new Date();
  const row = await prisma.newsletterSubscriber.findUnique({
    where: { confirmTokenHash: hashToken(token) },
    select: { id: true, status: true, confirmExpiresAt: true, topics: true },
  });
  const outcome = confirmOutcome(row, now);
  if (outcome !== "CONFIRMED" || !row) return outcome;

  const result = await prisma.newsletterSubscriber.updateMany({
    where: { id: row.id, status: "PENDING", confirmTokenHash: hashToken(token) },
    data: { status: "CONFIRMED", confirmedAt: now, confirmTokenHash: null, confirmExpiresAt: null },
  });
  if (result.count === 0) return "ALREADY_CONFIRMED";
  // The confirmation carries the scope and consent text of the sign-up it confirms.
  const request = await prisma.newsletterConsent.findFirst({
    where: { subscriberId: row.id, action: "REQUESTED" },
    orderBy: { createdAt: "desc" },
    select: { scope: true, consentText: true },
  });
  await prisma.newsletterConsent.create({
    data: {
      subscriberId: row.id,
      action: "CONFIRMED",
      topics: row.topics,
      source: "double-opt-in",
      scope: request?.scope ?? "SELECTED_TOPICS",
      consentText: request?.consentText ?? null,
      ipHash: hashIp(input.ip, linkSecret()),
    },
  });
  return "CONFIRMED";
}

export interface ManagedSubscriber {
  id: string;
  email: string;
  status: "PENDING" | "CONFIRMED" | "UNSUBSCRIBED";
  topics: NewsletterTopicName[];
}

/** The subscriber behind a signed preference link. Null when the signature is wrong or the row is gone. */
export async function subscriberForManageToken(token: string): Promise<ManagedSubscriber | null> {
  const id = verifyManageToken(token, linkSecret());
  if (!id) return null;
  const row = await prisma.newsletterSubscriber.findUnique({
    where: { id },
    select: { id: true, email: true, status: true, topics: true },
  });
  return row as ManagedSubscriber | null;
}

/** Changes topics for a confirmed subscriber. Keeps at least one topic. Records a consent change. */
export async function updateTopicsByToken(
  token: string,
  topics: string[],
  input: { ip: string | null },
): Promise<{ ok: true } | { ok: false; message: string }> {
  const subscriber = await subscriberForManageToken(token);
  if (!subscriber) return { ok: false, message: "This link is not valid. Use the newest email from us, or sign up again." };
  const wanted = normaliseTopics(topics);
  const problem = topicChangeProblem(subscriber.status, wanted);
  if (problem) return { ok: false, message: problem };
  await prisma.newsletterSubscriber.update({ where: { id: subscriber.id }, data: { topics: wanted } });
  await prisma.newsletterConsent.create({
    data: { subscriberId: subscriber.id, action: "TOPICS_CHANGED", topics: wanted, source: "preferences", ipHash: hashIp(input.ip, linkSecret()) },
  });
  return { ok: true };
}

/**
 * Unsubscribes by signed link. Idempotent: a second call still succeeds. Used by the one-click header (POST)
 * and by the unsubscribe page. Returns false only when the link itself is not valid.
 */
export async function unsubscribeByToken(token: string, input: { ip: string | null; source?: string }): Promise<boolean> {
  const subscriber = await subscriberForManageToken(token);
  if (!subscriber) return false;
  if (subscriber.status !== "UNSUBSCRIBED") {
    await prisma.newsletterSubscriber.update({
      where: { id: subscriber.id },
      data: { status: "UNSUBSCRIBED", unsubscribedAt: new Date() },
    });
    await prisma.newsletterConsent.create({
      data: { subscriberId: subscriber.id, action: "UNSUBSCRIBED", topics: subscriber.topics, source: input.source ?? "unsubscribe-link", ipHash: hashIp(input.ip, linkSecret()) },
    });
  }
  return true;
}

/**
 * Records a provider bounce or complaint: the address is suppressed (no future mail) and any subscription is
 * ended. Called from the webhook after the signature is verified. Idempotent.
 */
export async function suppressAddress(input: {
  email: string;
  reason: "BOUNCE" | "COMPLAINT";
  source: string;
}): Promise<void> {
  const email = normaliseEmail(input.email);
  if (!email) return;
  await prisma.emailSuppression.upsert({
    where: { email },
    create: { email, reason: input.reason, source: input.source },
    update: { reason: input.reason, source: input.source },
  });
  const subscriber = await prisma.newsletterSubscriber.findUnique({ where: { email }, select: { id: true, status: true, topics: true } });
  if (subscriber && subscriber.status !== "UNSUBSCRIBED") {
    await prisma.newsletterSubscriber.update({ where: { id: subscriber.id }, data: { status: "UNSUBSCRIBED", unsubscribedAt: new Date() } });
    await prisma.newsletterConsent.create({
      data: { subscriberId: subscriber.id, action: "UNSUBSCRIBED", topics: subscriber.topics, source: `provider:${input.reason.toLowerCase()}` },
    });
  }
  await recordAudit({ action: AuditAction.EMAIL_SUPPRESSED, actorId: null, entityType: "EmailSuppression", entityId: email, meta: { reason: input.reason, source: input.source } });
}

