import { createHmac } from "node:crypto";

/**
 * Referral rules. Pure except for the keyed hash, which needs a server secret. A referral counts only when the
 * referred seller is approved AND has published at least one listing. Fraud signals flag a referral for an admin;
 * they do not qualify or void it on their own.
 */

export const REFERRAL_RULES = {
  /** Sign-ups from one email domain, for one referrer, within a day, that flag the referrals for review. */
  bulkDomainThreshold: 3,
  bulkWindowHours: 24,
} as const;

export interface ReferralFlagSignal {
  /** Other referred sign-ups in the window that share this sign-up's IP hash. */
  sameIpOthers: number;
  /** Other referred sign-ups in the window that share this sign-up's device hash. */
  sameDeviceOthers: number;
  /** Referred sign-ups from the same email domain, for the same referrer, in the window (including this one). */
  sameDomainInWindow: number;
}

/** The reasons a referral needs an admin's look. Empty when none apply. */
export function referralFlagReasons(signal: ReferralFlagSignal): string[] {
  const reasons: string[] = [];
  if (signal.sameIpOthers > 0) reasons.push("Same IP address as another referred sign-up");
  if (signal.sameDeviceOthers > 0) reasons.push("Same device as another referred sign-up");
  if (signal.sameDomainInWindow >= REFERRAL_RULES.bulkDomainThreshold) {
    reasons.push(`${signal.sameDomainInWindow} sign-ups from one email domain for this referrer in ${REFERRAL_RULES.bulkWindowHours} hours`);
  }
  return reasons;
}

/** A referrer may not refer themselves: same account, or the same email address. Case-insensitive. */
export function isSelfReferral(input: { referrerUserId: string; referredUserId: string; referrerEmail: string; referredEmail: string }): boolean {
  if (input.referrerUserId === input.referredUserId) return true;
  return input.referrerEmail.trim().toLowerCase() === input.referredEmail.trim().toLowerCase();
}

export function emailDomain(email: string): string {
  const at = email.lastIndexOf("@");
  return at === -1 ? "" : email.slice(at + 1).trim().toLowerCase();
}

export type ReferralOutcome = "QUALIFY" | "WAIT" | "NONE";

/**
 * QUALIFY when the referral is pending, not flagged, the referred seller is approved and has at least one published
 * listing. WAIT when it is pending but not yet met (or flagged, for admin review). NONE when it is voided or qualified.
 */
export function referralOutcome(input: {
  status: "PENDING" | "QUALIFIED" | "VOIDED";
  flagged: boolean;
  referredApproved: boolean;
  referredPublishedListings: number;
}): ReferralOutcome {
  if (input.status !== "PENDING") return "NONE";
  if (input.flagged) return "WAIT";
  if (input.referredApproved && input.referredPublishedListings >= 1) return "QUALIFY";
  return "WAIT";
}

/**
 * A keyed hash for IP addresses and device cookies. The raw value is never stored. The secret keeps the hashes
 * from being reversed by guessing addresses.
 */
export function signalHash(value: string, secret: string): string {
  return createHmac("sha256", secret).update("referral-signal:" + value.trim()).digest("hex");
}
