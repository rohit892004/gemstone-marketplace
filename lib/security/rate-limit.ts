import { prisma } from "@/lib/db/client";

export interface RateLimitResult {
  allowed: boolean;
  /** Requests left in the current window (0 when blocked). */
  remaining: number;
  /** Seconds until the window resets. Use for Retry-After. */
  retryAfterSeconds: number;
}

/**
 * Fixed-window rate limiter backed by Postgres ("RateLimit" table), so limits hold
 * across server instances. Each call counts as one hit for `key`.
 *
 * Keys should combine the action and the subject, e.g.
 *   `login:ip:${ip}`, `login:email:${normalisedEmail}`, `otp:user:${userId}`.
 */
export async function consumeRateLimit(options: {
  key: string;
  limit: number;
  windowSeconds: number;
}): Promise<RateLimitResult> {
  const { key, limit, windowSeconds } = options;

  // One atomic statement: start a new window if the old one expired, otherwise increment.
  // Timestamps are stored as UTC without zone (Prisma convention), hence "AT TIME ZONE 'UTC'".
  const rows = await prisma.$queryRaw<{ count: number; windowStart: Date }[]>`
    INSERT INTO "RateLimit" ("key", "count", "windowStart", "updatedAt")
    VALUES (${key}, 1, (now() AT TIME ZONE 'UTC'), (now() AT TIME ZONE 'UTC'))
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE
        WHEN "RateLimit"."windowStart" < (now() AT TIME ZONE 'UTC') - make_interval(secs => ${windowSeconds})
          THEN 1
        ELSE "RateLimit"."count" + 1
      END,
      "windowStart" = CASE
        WHEN "RateLimit"."windowStart" < (now() AT TIME ZONE 'UTC') - make_interval(secs => ${windowSeconds})
          THEN (now() AT TIME ZONE 'UTC')
        ELSE "RateLimit"."windowStart"
      END,
      "updatedAt" = (now() AT TIME ZONE 'UTC')
    RETURNING "count", "windowStart"
  `;

  const row = rows[0];
  const count = Number(row.count);
  const windowEndMs = new Date(row.windowStart).getTime() + windowSeconds * 1000;
  const retryAfterSeconds = Math.max(1, Math.ceil((windowEndMs - Date.now()) / 1000));

  return {
    allowed: count <= limit,
    remaining: Math.max(0, limit - count),
    retryAfterSeconds,
  };
}

/** Removes a key's counter (e.g. after a successful login clears the per-email limit). */
export async function resetRateLimit(key: string): Promise<void> {
  await prisma.rateLimit.deleteMany({ where: { key } });
}
