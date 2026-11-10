/**
 * Turns an error from a valuation server action into text that is safe to show. Domain errors (ValuationError)
 * pass their message through: those messages are written to be shown, including RATE_LIMITED and CONTACT_DETAILS.
 * Anything else becomes a generic message, and the detail is never shown.
 */

export const GENERIC_VALUATION_ERROR = "Something went wrong. Try again.";
export const ACCOUNT_CANNOT_ACT = "Your account cannot do this right now.";

export function valuationErrorMessage(error: unknown): string {
  if (typeof error === "object" && error !== null) {
    const name = (error as { name?: unknown }).name;
    const message = (error as { message?: unknown }).message;
    if (name === "ValuationError" && typeof message === "string" && message.length > 0) return message;
    if (name === "AuthzError") return ACCOUNT_CANNOT_ACT;
  }
  return GENERIC_VALUATION_ERROR;
}
