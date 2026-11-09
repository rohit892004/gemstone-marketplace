import { MessagingError } from "@/lib/messaging/service";
import { AuthzError } from "@/lib/auth/require-role";

/**
 * Domain errors for quotations, offer responses and requirement responses. Messages are safe to show
 * to the user. `conversationId` is set when the error points at an existing thread (for example a
 * requirement the seller already responded to).
 */
export type CommerceErrorCode =
  | "NOT_FOUND"
  | "INVALID"
  | "NOT_ALLOWED"
  | "CONFLICT"
  | "CLOSED"
  | "EXPIRED"
  | "BLOCKED"
  | "RATE_LIMITED";

export class CommerceError extends Error {
  constructor(
    readonly code: CommerceErrorCode,
    message: string,
    readonly conversationId?: string,
  ) {
    super(message);
    this.name = "CommerceError";
  }
}

/** Message for a user-facing action result, or null when the error is unexpected and must be logged. */
export function commerceErrorMessage(error: unknown): string | null {
  if (error instanceof CommerceError) return error.message;
  if (error instanceof MessagingError) return error.message;
  if (error instanceof AuthzError) return "Your account can't do this right now.";
  return null;
}
