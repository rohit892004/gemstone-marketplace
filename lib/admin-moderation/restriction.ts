/**
 * Messaging restriction for admin actions. Pure: callers pass the clock and the current value.
 * A restriction set by an admin never shortens one that is already longer (for example one set
 * by repeated contact-detail strikes).
 */

export const RESTRICTION_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

/** The restriction end time after an admin action at `now`. */
export function restrictionUntil(now: Date, currentUntil: Date | null): Date {
  const candidate = new Date(now.getTime() + RESTRICTION_DAYS * DAY_MS);
  if (currentUntil && currentUntil.getTime() > candidate.getTime()) return currentUntil;
  return candidate;
}

export function isRestricted(until: Date | null | undefined, now: Date): boolean {
  return Boolean(until && until.getTime() > now.getTime());
}
