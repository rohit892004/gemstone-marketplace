/**
 * Rate-limit rows are only needed while their window is open. Every hit refreshes updatedAt, and all
 * windows are 24 hours or shorter, so a row untouched for 24 hours has an expired window.
 * Pure (no database import) so the cutoff can be unit tested.
 */
export const RATE_LIMIT_RETENTION_MS = 24 * 60 * 60 * 1000;

/** Rows whose updatedAt is before this instant are deleted. */
export function rateLimitCutoff(now: Date): Date {
  return new Date(now.getTime() - RATE_LIMIT_RETENTION_MS);
}
