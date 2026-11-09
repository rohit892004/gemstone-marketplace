import { z } from "zod";

/** Reasons and notes written by an admin. Shown back to admins only. */
export const ADMIN_REASON_MIN = 10;
export const ADMIN_REASON_MAX = 500;

const adminReason = z
  .string()
  .trim()
  .min(ADMIN_REASON_MIN, `Give a reason of at least ${ADMIN_REASON_MIN} characters`)
  .max(ADMIN_REASON_MAX, `Use at most ${ADMIN_REASON_MAX} characters`);

const optionalNote = z
  .string()
  .trim()
  .max(ADMIN_REASON_MAX, `Use at most ${ADMIN_REASON_MAX} characters`)
  .transform((value) => (value === "" ? undefined : value));

/** Ids are cuid-like. Anything else is refused before it reaches a query or a cookie name. */
export const idSchema = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/, "Invalid id");

export const conversationReasonSchema = z.object({
  conversationId: idSchema,
  reason: adminReason,
});

export const flagDecisionSchema = z.object({
  flagId: idSchema,
  decision: z.enum(["DISMISS", "ACTION"]),
  restrict: z.boolean(),
  note: optionalNote,
});

export const reportDecisionSchema = z.object({
  reportId: idSchema,
  decision: z.enum(["RESOLVE", "DISMISS"]),
  restrict: z.boolean(),
  note: adminReason,
});

export const requirementCloseSchema = z.object({
  requirementId: idSchema,
  reason: adminReason,
});

/** Form checkboxes post "on" when ticked and nothing when not. */
export function checkboxIsOn(value: FormDataEntryValue | null): boolean {
  return value === "on" || value === "true";
}
