import { CONFIRM_TOKEN_TTL_MS } from "./tokens";
import { wantsAnyTopic } from "./topics";

/** Pure newsletter rules. The service applies them inside conditional updates. */

export type SubscriberStatusName = "PENDING" | "CONFIRMED" | "UNSUBSCRIBED";

export interface SubscriberSnapshot {
  status: SubscriberStatusName;
  topics: readonly string[];
}

/** Outcome of following a confirmation link. */
export type ConfirmOutcome = "CONFIRMED" | "ALREADY_CONFIRMED" | "EXPIRED" | "INVALID";

export function confirmOutcome(
  row: { status: SubscriberStatusName; confirmExpiresAt: Date | null } | null,
  now: Date,
): ConfirmOutcome {
  if (!row) return "INVALID";
  if (row.status === "CONFIRMED") return "ALREADY_CONFIRMED";
  if (row.status !== "PENDING") return "INVALID";
  if (!row.confirmExpiresAt || row.confirmExpiresAt.getTime() <= now.getTime()) return "EXPIRED";
  return "CONFIRMED";
}

export function confirmExpiry(now: Date): Date {
  return new Date(now.getTime() + CONFIRM_TOKEN_TTL_MS);
}

/**
 * Whether a campaign or digest may be sent to this subscriber right now.
 * Only confirmed subscribers, who are not suppressed, and who chose at least one target topic.
 */
export function mayReceive(
  subscriber: SubscriberSnapshot,
  target: readonly string[],
  suppressed: boolean,
): { ok: true } | { ok: false; reason: "not_confirmed" | "suppressed" | "no_matching_topic" } {
  if (subscriber.status !== "CONFIRMED") return { ok: false, reason: "not_confirmed" };
  if (suppressed) return { ok: false, reason: "suppressed" };
  if (!wantsAnyTopic(subscriber.topics, target)) return { ok: false, reason: "no_matching_topic" };
  return { ok: true };
}

/** Topic changes are allowed only for confirmed subscribers, and they always keep at least one topic. */
export function topicChangeProblem(status: SubscriberStatusName, topics: readonly string[]): string | null {
  if (status !== "CONFIRMED") return "Confirm your subscription first.";
  if (topics.length === 0) return "Choose at least one topic, or unsubscribe instead.";
  return null;
}
