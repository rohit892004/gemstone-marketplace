import { randomBytes, createHash } from "node:crypto";
import { getEnv } from "@/lib/config/env";
import { prisma } from "@/lib/db/client";
import {
  dayKey,
  dedupeKeyFor,
  looksLikeContactDetail,
  normaliseTerm,
  shouldRecord,
  visitorHash,
  type EventKind,
} from "./events";

/**
 * Records analytics events. The only writer of AnalyticsEvent. Every call goes through shouldRecord, so staff,
 * bots and sellers viewing their own pages never count, and views are deduplicated per visitor, item and day.
 */

export const VISITOR_COOKIE = "gs_vid";
const COOKIE_MAX_AGE_SECONDS = 365 * 24 * 60 * 60;

/** The daily salt's root. Derived from AUTH_SECRET, so the stored hashes cannot be rebuilt without the secret. */
function analyticsSecret(): string {
  const base = getEnv().AUTH_SECRET ?? "local-development-analytics-secret";
  return createHash("sha256").update("analytics|" + base).digest("hex");
}

export function newVisitorId(): string {
  return randomBytes(16).toString("hex");
}

/** A visitor id from the cookie value. Only the expected shape is accepted; anything else is treated as no visitor. */
export function validVisitorId(value: string | null | undefined): string | null {
  return value && /^[a-f0-9]{32}$/.test(value) ? value : null;
}

/** The Set-Cookie value for a new visitor. HttpOnly, first-party, a year. */
export function visitorCookie(value: string, secure: boolean): string {
  return [
    `${VISITOR_COOKIE}=${value}`,
    "Path=/",
    `Max-Age=${COOKIE_MAX_AGE_SECONDS}`,
    "SameSite=Lax",
    "HttpOnly",
    secure ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");
}

export interface RecordInput {
  kind: EventKind;
  /** Raw visitor cookie value (validated here). Null for server events with no visitor. */
  visitorId: string | null;
  sellerId?: string | null;
  gemstoneId?: string | null;
  categoryId?: string | null;
  term?: string | null;
  actorRole?: string | null;
  actorUserId?: string | null;
  /** The user who owns the seller profile or listing, so the owner's own views are not counted. */
  ownerUserId?: string | null;
  userAgent?: string | null;
  now?: Date;
}

export type RecordResult = { recorded: true } | { recorded: false; reason: string };

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === "P2002";
}

/** Writes one event, unless the rules refuse it or it is a repeat view. Never throws on a repeat. */
export async function recordEvent(input: RecordInput): Promise<RecordResult> {
  const decision = shouldRecord({
    actorRole: input.actorRole ?? null,
    actorUserId: input.actorUserId ?? null,
    ownerUserId: input.ownerUserId ?? null,
    userAgent: input.userAgent,
  });
  if (!decision.record) return { recorded: false, reason: decision.reason };

  const term = input.kind === "SEARCH" ? normaliseTerm(input.term) : null;
  if (input.kind === "SEARCH" && term === null) return { recorded: false, reason: "no-term" };
  if (term !== null && looksLikeContactDetail(term)) return { recorded: false, reason: "contact-like" };

  const now = input.now ?? new Date();
  const day = dayKey(now);
  const visitor = validVisitorId(input.visitorId);
  // A wishlist add is deduplicated per buyer, so the buyer's id (salted and hashed daily) stands in for the visitor.
  const subject = input.kind === "WISHLIST_ADD" && input.actorUserId ? input.actorUserId : visitor;
  const hash = subject ? visitorHash(subject, day, analyticsSecret()) : null;
  const target = input.gemstoneId ?? input.sellerId ?? "";
  const dedupeKey = dedupeKeyFor(input.kind, day, hash, target);

  try {
    await prisma.analyticsEvent.create({
      data: {
        kind: input.kind,
        occurredAt: now,
        day: new Date(day + "T00:00:00.000Z"),
        visitorHash: hash,
        sellerId: input.sellerId ?? null,
        gemstoneId: input.gemstoneId ?? null,
        categoryId: input.categoryId ?? null,
        term,
        dedupeKey,
      },
    });
    return { recorded: true };
  } catch (error) {
    if (isUniqueViolation(error) && dedupeKey) return { recorded: false, reason: "repeat-view" };
    throw error;
  }
}
