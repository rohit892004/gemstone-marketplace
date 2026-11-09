import { consumeRateLimit } from "@/lib/security/rate-limit";

const HOUR = 60 * 60;

/** Counts one hit for `key` and reports whether it is still within `limit` per hour. */
export async function withinHourlyLimit(key: string, limit: number): Promise<boolean> {
  const result = await consumeRateLimit({ key, limit, windowSeconds: HOUR });
  return result.allowed;
}

/**
 * Limits from the M1 spec. Callers build the keys so the subject (ip, email, user id)
 * is explicit at the call site.
 */
export const LIMITS = {
  register: { ip: 10 },
  forgot: { ip: 10, email: 5 },
  otpSend: { user: 5 },
  otpVerify: { user: 20 },
  verifyResend: { email: 5 },
} as const;
