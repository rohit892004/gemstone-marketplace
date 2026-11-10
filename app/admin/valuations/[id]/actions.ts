"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/require-role";
import { formId, formString, NOT_FOUND_STATE, serviceFailure } from "@/lib/valuation/action-helpers";
import type { ValuationActionState } from "@/lib/valuation/form-state";
import { assignValuation, rejectValuation, withdrawValuation } from "@/lib/valuation/service";
import { VALUATION_ROUTES } from "@/lib/valuation/routes";

/**
 * Admin decisions on one valuation. The admin identity comes from the session (requireRole). The services check
 * the status and the role again.
 */

const ID_LIKE = /^[a-z0-9]{8,64}$/i;

function refresh(valuationId: string): void {
  revalidatePath(VALUATION_ROUTES.adminDetail(valuationId));
  revalidatePath(VALUATION_ROUTES.adminQueue);
}

export async function assignAction(_prev: ValuationActionState, formData: FormData): Promise<ValuationActionState> {
  const admin = await requireRole(["ADMIN"]);
  const valuationId = formId(formData);
  if (!valuationId) return NOT_FOUND_STATE;
  const raw = formString(formData, "valuatorId").trim();
  if (raw !== "" && !ID_LIKE.test(raw)) return { ok: false, error: "Choose a valuer from the list.", fieldErrors: { valuatorId: "Choose a valuer from the list." } };
  const valuatorId = raw === "" ? null : raw;
  try {
    await assignValuation({ valuationId, admin: { id: admin.id, role: admin.role }, valuatorId });
  } catch (error) {
    return serviceFailure(error);
  }
  refresh(valuationId);
  return { ok: true, message: valuatorId ? "Valuer assigned. They have been notified." : "Valuer removed. The request is unassigned." };
}

export async function adminRejectAction(_prev: ValuationActionState, formData: FormData): Promise<ValuationActionState> {
  const admin = await requireRole(["ADMIN"]);
  const valuationId = formId(formData);
  if (!valuationId) return NOT_FOUND_STATE;
  const reason = formString(formData, "reason");
  try {
    await rejectValuation({ valuationId, actor: { id: admin.id, role: admin.role }, reason });
  } catch (error) {
    return serviceFailure(error, { reason });
  }
  refresh(valuationId);
  return { ok: true, message: "The request was rejected and the requester was told." };
}

export async function withdrawAction(_prev: ValuationActionState, formData: FormData): Promise<ValuationActionState> {
  const admin = await requireRole(["ADMIN"]);
  const valuationId = formId(formData);
  if (!valuationId) return NOT_FOUND_STATE;
  const reason = formString(formData, "reason");
  try {
    await withdrawValuation({ valuationId, admin: { id: admin.id, role: admin.role }, reason });
  } catch (error) {
    return serviceFailure(error, { reason });
  }
  refresh(valuationId);
  return { ok: true, message: "The report is withdrawn. Its verification page now shows withdrawn." };
}
