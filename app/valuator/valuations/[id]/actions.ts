"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/require-role";
import { formId, formString, NOT_FOUND_STATE, serviceFailure } from "@/lib/valuation/action-helpers";
import { CONFIDENCE_LEVELS } from "@/lib/valuation/validate";
import type { ValuationActionState } from "@/lib/valuation/form-state";
import { parseMajorToMinor } from "@/lib/money/money";
import { rejectValuation, requestValuationInfo, signOffValuation } from "@/lib/valuation/service";
import { VALUATION_ROUTES } from "@/lib/valuation/routes";

/**
 * Valuator decisions. The valuator's identity and role come from the session (requireRole). The service checks the
 * assignment and the status again, so a stale or forged form cannot act on someone else's request.
 */

const AMOUNT_HELP = "Enter an amount above zero with at most two decimals, such as 12500.50.";

export async function askForInfoAction(_prev: ValuationActionState, formData: FormData): Promise<ValuationActionState> {
  const user = await requireRole(["VALUATOR"]);
  const valuationId = formId(formData);
  if (!valuationId) return NOT_FOUND_STATE;
  const body = formString(formData, "body");
  try {
    await requestValuationInfo({ valuationId, valuator: { id: user.id, role: user.role }, body });
  } catch (error) {
    return serviceFailure(error, { body });
  }
  revalidatePath(VALUATION_ROUTES.valuatorDetail(valuationId));
  return { ok: true, message: "Your question was sent. The requester will reply on the platform." };
}

export async function signOffAction(_prev: ValuationActionState, formData: FormData): Promise<ValuationActionState> {
  const user = await requireRole(["VALUATOR"]);
  const valuationId = formId(formData);
  if (!valuationId) return NOT_FOUND_STATE;

  const values = {
    estimate: formString(formData, "estimate").trim(),
    low: formString(formData, "low").trim(),
    high: formString(formData, "high").trim(),
    confidence: formString(formData, "confidence").trim(),
    notes: formString(formData, "notes"),
  };
  const fieldErrors: Record<string, string> = {};
  for (const key of ["estimate", "low", "high"] as const) {
    if (!parseMajorToMinor(values[key]).ok) fieldErrors[key] = AMOUNT_HELP;
  }
  if (!(CONFIDENCE_LEVELS as readonly string[]).includes(values.confidence)) fieldErrors.confidence = "Choose a confidence level.";
  if (values.notes.trim().length === 0) fieldErrors.notes = "Enter a note that explains the value.";
  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, error: "Check the highlighted fields.", fieldErrors, values };
  }

  try {
    await signOffValuation({ valuationId, valuator: { id: user.id, role: user.role }, raw: values });
  } catch (error) {
    return serviceFailure(error, values);
  }
  revalidatePath(VALUATION_ROUTES.valuatorQueue);
  redirect(VALUATION_ROUTES.valuatorQueue);
}

export async function rejectAction(_prev: ValuationActionState, formData: FormData): Promise<ValuationActionState> {
  const user = await requireRole(["VALUATOR"]);
  const valuationId = formId(formData);
  if (!valuationId) return NOT_FOUND_STATE;
  const reason = formString(formData, "reason");
  try {
    await rejectValuation({ valuationId, actor: { id: user.id, role: user.role }, reason });
  } catch (error) {
    return serviceFailure(error, { reason });
  }
  revalidatePath(VALUATION_ROUTES.valuatorQueue);
  redirect(VALUATION_ROUTES.valuatorQueue);
}
