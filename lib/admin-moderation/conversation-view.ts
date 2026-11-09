import { ADMIN_REASON_MAX, ADMIN_REASON_MIN } from "@/lib/admin-moderation/schemas";

/**
 * How an admin's conversation view stays open between page loads.
 *
 * The reason form stores the reason in an httpOnly cookie that is scoped to one conversation's
 * path and lasts 30 minutes. The conversation page reads the cookie on every render and calls
 * viewConversationAsAdmin() each time, so EVERY load writes its own audit row. A refresh or a
 * second tab adds a row; it can never show the conversation without one. Nothing is shown when
 * the cookie is missing, expired or invalid: the reason form appears instead.
 */

export const VIEW_WINDOW_SECONDS = 30 * 60;

export function viewCookieName(conversationId: string): string {
  return `admin_view_${conversationId}`;
}

export function viewCookiePath(conversationId: string): string {
  return `/admin/conversations/${conversationId}`;
}

export function encodeViewReason(reason: string): string {
  return encodeURIComponent(reason.trim());
}

/** Returns the reason when the cookie holds a valid one, otherwise null. Never throws. */
export function decodeViewReason(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const reason = decodeURIComponent(value).trim();
    if (reason.length < ADMIN_REASON_MIN || reason.length > ADMIN_REASON_MAX) return null;
    return reason;
  } catch {
    return null;
  }
}
