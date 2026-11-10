"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/require-role";
import { formString } from "@/lib/valuation/action-helpers";
import type { ValuationActionState } from "@/lib/valuation/form-state";
import { createValuator, resendSetPasswordLink, setValuatorActive } from "@/lib/valuation/admin-valuators";
import { VALUATION_ROUTES } from "@/lib/valuation/routes";

/** Valuator account actions. Admin only, checked by requireRole against the session. */

const PAGE = "/admin/valuations/valuators";

/** Puts a service message beside the matching field. */
function fieldFor(message: string): string | null {
  if (/name/i.test(message)) return "name";
  if (/email/i.test(message)) return "email";
  if (/mobile/i.test(message)) return "mobile";
  return null;
}

export async function createValuatorAction(_prev: ValuationActionState, formData: FormData): Promise<ValuationActionState> {
  const admin = await requireRole(["ADMIN"]);
  const values = {
    name: formString(formData, "name"),
    email: formString(formData, "email"),
    mobile: formString(formData, "mobile"),
  };
  const result = await createValuator({ admin: { id: admin.id }, raw: values });
  if (!result.ok) {
    const field = fieldFor(result.error);
    return {
      ok: false,
      error: result.error,
      ...(field ? { fieldErrors: { [field]: result.error } } : {}),
      values,
    };
  }
  revalidatePath(PAGE);
  return {
    ok: true,
    message: "Valuer account created. A link to set their password has been emailed to them. The link lasts 30 minutes.",
  };
}

export async function setActiveAction(_prev: ValuationActionState, formData: FormData): Promise<ValuationActionState> {
  const admin = await requireRole(["ADMIN"]);
  const valuatorId = formString(formData, "valuatorId");
  if (!/^[a-z0-9]{8,64}$/i.test(valuatorId)) return { ok: false, error: "Valuer not found." };
  const active = formString(formData, "active") === "true";
  const result = await setValuatorActive({ admin: { id: admin.id }, valuatorId, active });
  if (!result.ok) return { ok: false, error: result.error };
  revalidatePath(PAGE);
  revalidatePath(VALUATION_ROUTES.adminQueue);
  return {
    ok: true,
    message: active
      ? "Valuer reactivated. They can sign in again."
      : "Valuer deactivated. They can no longer sign in or act. Reassign their open requests.",
  };
}

export async function resendSetPasswordAction(_prev: ValuationActionState, formData: FormData): Promise<ValuationActionState> {
  const admin = await requireRole(["ADMIN"]);
  const valuatorId = formString(formData, "valuatorId");
  if (!/^[a-z0-9]{8,64}$/i.test(valuatorId)) return { ok: false, error: "Valuer not found." };
  const result = await resendSetPasswordLink({ admin: { id: admin.id }, valuatorId });
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, message: "A new link to set the password was emailed. Any earlier link no longer works." };
}
