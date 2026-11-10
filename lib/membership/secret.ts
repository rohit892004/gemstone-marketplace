import { createHash } from "node:crypto";
import { getEnv } from "@/lib/config/env";

/**
 * The key for referral signal hashes (IP address and device cookie). Derived from AUTH_SECRET so the stored hashes
 * cannot be reversed by guessing addresses without the server secret. Development without AUTH_SECRET uses a fixed,
 * clearly named fallback. Production without AUTH_SECRET refuses, so the attribution call logs and skips.
 */
export const DEV_REFERRAL_SECRET_FALLBACK = "local-development-referral-secret-not-for-production";

export function referralSignalSecret(): string {
  const env = getEnv();
  if (!env.AUTH_SECRET && env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET is required in production for referral signal hashes.");
  }
  const base = env.AUTH_SECRET ?? DEV_REFERRAL_SECRET_FALLBACK;
  return createHash("sha256").update("referral-signal-key|" + base).digest("hex");
}
