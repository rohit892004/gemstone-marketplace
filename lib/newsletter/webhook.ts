import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verifies a Resend webhook. Resend signs deliveries with the Svix scheme:
 *   signed content = "<svix-id>.<svix-timestamp>.<raw body>"
 *   signature      = base64(HMAC-SHA256(key, signed content)), sent as "v1,<sig>" (several may be listed)
 *   key            = base64-decoded part of the signing secret after "whsec_"
 * Deliveries older or newer than the tolerance are refused, so a captured request cannot be replayed later.
 */

export const WEBHOOK_TOLERANCE_SECONDS = 5 * 60;

export type WebhookCheck = { ok: true } | { ok: false; reason: "missing_headers" | "bad_secret" | "stale" | "bad_signature" };

export function verifyResendWebhook(input: {
  body: string;
  id: string | null;
  timestamp: string | null;
  signature: string | null;
  secret: string;
  now?: Date;
}): WebhookCheck {
  if (!input.id || !input.timestamp || !input.signature) return { ok: false, reason: "missing_headers" };
  if (!input.secret.startsWith("whsec_")) return { ok: false, reason: "bad_secret" };
  const key = Buffer.from(input.secret.slice("whsec_".length), "base64");
  if (key.length === 0) return { ok: false, reason: "bad_secret" };

  const seconds = Number(input.timestamp);
  const nowSeconds = Math.floor((input.now ?? new Date()).getTime() / 1000);
  if (!Number.isFinite(seconds) || Math.abs(nowSeconds - seconds) > WEBHOOK_TOLERANCE_SECONDS) {
    return { ok: false, reason: "stale" };
  }

  const expected = createHmac("sha256", key).update(`${input.id}.${input.timestamp}.${input.body}`).digest();
  const candidates = input.signature.split(" ").map((part) => part.trim()).filter((part) => part.startsWith("v1,"));
  for (const candidate of candidates) {
    const given = Buffer.from(candidate.slice(3), "base64");
    if (given.length === expected.length && timingSafeEqual(given, expected)) return { ok: true };
  }
  return { ok: false, reason: "bad_signature" };
}

export interface ResendEvent {
  type: string;
  recipients: string[];
}

/** Reads the event type and the recipient addresses. Returns null for anything that is not an event object. */
export function parseResendEvent(body: string): ResendEvent | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const event = parsed as { type?: unknown; data?: { to?: unknown } };
  if (typeof event.type !== "string") return null;
  const to = Array.isArray(event.data?.to) ? event.data.to : [];
  return { type: event.type, recipients: to.filter((v): v is string => typeof v === "string") };
}
