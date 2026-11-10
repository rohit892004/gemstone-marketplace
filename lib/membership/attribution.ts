import { signalHash } from "./referrals";

/**
 * Inputs for referral attribution at seller sign-up. Pure. The raw IP address and visitor cookie are never stored:
 * only keyed hashes of them go to the Referral row.
 */

/** Codes come from ensureReferralCode: 8 characters from an uppercase alphanumeric alphabet. */
const CODE_PATTERN = /^[A-Z0-9]{6,16}$/;

/** Trims and upper-cases a submitted code. Null when it is not shaped like a code (unknown codes are ignored anyway). */
export function normaliseReferralCode(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  const code = raw.trim().toUpperCase();
  return CODE_PATTERN.test(code) ? code : null;
}

/**
 * Keyed hashes for the sign-up's network and device signals. An unknown IP ("unknown", from getClientIp) or a missing
 * visitor gives null, so two unknowns never look like the same device.
 */
export function attributionSignals(input: { ip: string | null | undefined; visitorId: string | null | undefined; secret: string }): {
  ipHash: string | null;
  deviceHash: string | null;
} {
  const ip = typeof input.ip === "string" ? input.ip.trim() : "";
  const ipHash = ip && ip !== "unknown" ? signalHash("ip:" + ip, input.secret) : null;
  const visitor = typeof input.visitorId === "string" ? input.visitorId.trim() : "";
  const deviceHash = visitor ? signalHash("device:" + visitor, input.secret) : null;
  return { ipHash, deviceHash };
}
