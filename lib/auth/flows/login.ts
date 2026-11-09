/**
 * Login helpers. Pure functions, so they are unit-testable without Auth.js.
 */

const LOGIN_MESSAGES: Record<string, string> = {
  email_not_verified: "Verify your email address before logging in. Check your inbox for the link.",
  account_suspended: "This account is suspended. Contact support if you think this is a mistake.",
  rate_limited: "Too many attempts. Please try again later.",
};

export const INVALID_LOGIN_MESSAGE = "Invalid email or password.";

/** Maps an Auth.js / app error code to a friendly message. Unknown codes get the generic message. */
export function loginMessageForCode(code: unknown): string {
  if (typeof code === "string" && Object.prototype.hasOwnProperty.call(LOGIN_MESSAGES, code)) {
    return LOGIN_MESSAGES[code];
  }
  return INVALID_LOGIN_MESSAGE;
}

/**
 * Accepts only same-origin relative paths such as "/buyer" or "/x?y=1".
 * Rejects absolute URLs, protocol-relative "//host", backslash tricks and control characters.
 */
export function safeNextPath(value: unknown, fallback = "/dashboard"): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 2048) return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  if (/[\u0000-\u001f\u007f\\]/.test(value)) return fallback;
  // The resolved URL must stay on the placeholder origin.
  try {
    if (new URL(value, "http://local.invalid").origin !== "http://local.invalid") return fallback;
  } catch {
    return fallback;
  }
  return value;
}
