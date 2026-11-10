import { createHash } from "node:crypto";

/**
 * Analytics rules. Pure: no database, no request. Tracking is first-party and privacy-safe:
 *
 *  - No personal data. The visitor is a random first-party cookie, hashed with a salt that changes every day.
 *    A visitor cannot be linked from one day to the next, and no raw cookie is stored.
 *  - Views count once per visitor, per item, per day (the dedupe key).
 *  - Bots, admins, valuators and sellers viewing their own pages are not recorded.
 *  - Raw events are kept 90 days, then deleted by the rollup job. Dashboards read the rollups.
 */

export const EVENT_KINDS = [
  "PROFILE_VIEW",
  "LISTING_VIEW",
  "LISTING_IMPRESSION",
  "WISHLIST_ADD",
  "ENQUIRY_STARTED",
  "QUOTATION_SENT",
  "QUOTATION_ACCEPTED",
  "VALUATION_REQUESTED",
  "FOLLOW",
  "SEARCH",
] as const;
export type EventKind = (typeof EVENT_KINDS)[number];

/** Kinds the browser may send to the tracking endpoint. Everything else is recorded on the server, by the action. */
export const CLIENT_EVENT_KINDS: readonly EventKind[] = ["PROFILE_VIEW", "LISTING_VIEW", "LISTING_IMPRESSION", "SEARCH"];

/** Views are deduplicated per visitor, per item, per day. Impressions and actions are counted every time. */
export const DEDUPED_KINDS: readonly EventKind[] = ["PROFILE_VIEW", "LISTING_VIEW"];

export const RETENTION_DAYS = 90;
export const MAX_TERM_LENGTH = 80;
const DAY_MS = 24 * 60 * 60 * 1000;

/** The UTC calendar day, as YYYY-MM-DD. */
export function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * The hash stored in place of a visitor. It mixes a secret, the day and the cookie value, so the same visitor gets
 * a different hash each day and the cookie cannot be read back from the stored value.
 */
export function visitorHash(visitorId: string, day: string, secret: string): string {
  return createHash("sha256").update(`${secret}|${day}|${visitorId}`).digest("hex");
}

/** A key that makes a repeat view a no-op (unique constraint). Null for kinds that are not deduplicated. */
export function dedupeKeyFor(kind: EventKind, day: string, hash: string | null, targetId: string): string | null {
  if (!hash || !DEDUPED_KINDS.includes(kind)) return null;
  return `${kind}:${day}:${hash}:${targetId}`;
}

/** Search terms: trimmed, lower-cased, spaces collapsed, at most 80 characters. Null when too short to mean anything. */
export function normaliseTerm(term: string | null | undefined): string | null {
  if (!term) return null;
  const cleaned = term.trim().toLowerCase().replace(/\s+/g, " ").slice(0, MAX_TERM_LENGTH);
  return cleaned.length >= 2 ? cleaned : null;
}

const BOT_PATTERN = /bot|crawl|spider|slurp|headless|lighthouse|pingdom|uptime|preview|facebookexternalhit|curl|wget|python-requests|go-http-client/i;

/** A missing or bot-like user agent is not a person. */
export function isBotUserAgent(userAgent: string | null | undefined): boolean {
  if (!userAgent || userAgent.trim().length === 0) return true;
  return BOT_PATTERN.test(userAgent);
}

export interface RecordDecision {
  record: boolean;
  reason: "ok" | "bot" | "staff" | "own-page";
}

/**
 * Whether one event is recorded at all. Staff (admins and valuators) and bots never count. A seller viewing their
 * own profile or listing never counts toward their own numbers.
 */
export function shouldRecord(input: {
  actorRole: string | null;
  actorUserId: string | null;
  ownerUserId: string | null;
  userAgent: string | null | undefined;
}): RecordDecision {
  if (isBotUserAgent(input.userAgent)) return { record: false, reason: "bot" };
  if (input.actorRole === "ADMIN" || input.actorRole === "VALUATOR") return { record: false, reason: "staff" };
  if (input.actorUserId && input.ownerUserId && input.actorUserId === input.ownerUserId) return { record: false, reason: "own-page" };
  return { record: true, reason: "ok" };
}

/** Raw events older than this are deleted by the rollup job. */
export function retentionCutoff(now: Date): Date {
  return new Date(now.getTime() - RETENTION_DAYS * DAY_MS);
}
