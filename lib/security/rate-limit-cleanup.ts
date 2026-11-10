import { prisma } from "@/lib/db/client";
import { rateLimitCutoff } from "@/lib/security/rate-limit-retention";

/** Deletes rate-limit rows untouched for 24 hours. Returns how many were removed. Run hourly by the worker. */
export async function cleanupRateLimits(now: Date = new Date()): Promise<number> {
  const result = await prisma.rateLimit.deleteMany({ where: { updatedAt: { lt: rateLimitCutoff(now) } } });
  return result.count;
}
