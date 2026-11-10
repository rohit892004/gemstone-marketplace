import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";

/**
 * Tokens for the newsletter.
 * - Confirmation links (double opt-in): random, single use, expiring. Only the SHA-256 hash is stored.
 * - Preference and unsubscribe links: "<subscriberId>.<signature>", where the signature is an HMAC of the
 *   subscriber id under a key derived from AUTH_SECRET. Nothing is stored, so the same link works on every
 *   message, and rotating AUTH_SECRET revokes every outstanding link.
 * Links never reveal whether an address exists: a wrong or forged token returns null, the same as an unknown one.
 */

export const CONFIRM_TOKEN_TTL_MS = 48 * 60 * 60 * 1000;

export function generateConfirmToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function signingKey(secret: string): Buffer {
  return createHmac("sha256", secret).update("gemstone:newsletter-links:v1").digest();
}

function sign(subscriberId: string, secret: string): string {
  return createHmac("sha256", signingKey(secret)).update(`manage:${subscriberId}`).digest("base64url");
}

/** Signed preference link token for a subscriber. */
export function signManageToken(subscriberId: string, secret: string): string {
  return `${subscriberId}.${sign(subscriberId, secret)}`;
}

/** Returns the subscriber id when the token's signature is valid, otherwise null. Constant-time compare. */
export function verifyManageToken(token: string, secret: string): string | null {
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const subscriberId = token.slice(0, dot);
  const given = Buffer.from(token.slice(dot + 1));
  const expected = Buffer.from(sign(subscriberId, secret));
  if (given.length !== expected.length) return null;
  return timingSafeEqual(given, expected) ? subscriberId : null;
}

/**
 * Hashes a client IP with a secret salt for the consent record. The raw IP is never stored.
 * Unknown addresses hash to a fixed value, so the record still shows "no IP".
 */
export function hashIp(ip: string | null | undefined, secret: string): string | null {
  if (!ip || ip === "unknown") return null;
  return createHmac("sha256", signingKey(secret)).update(`ip:${ip}`).digest("hex");
}

const emailSchema = z.string().trim().toLowerCase().max(254).email();

/** Normalised email (trimmed, lowercase) or null when it is not a usable address. */
export function normaliseEmail(input: string): string | null {
  const parsed = emailSchema.safeParse(input);
  return parsed.success ? parsed.data : null;
}
