"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/require-role";
import { formString } from "@/lib/valuation/action-helpers";
import type { ValuationActionState } from "@/lib/valuation/form-state";
import { saveThresholdSettings } from "@/lib/valuation/admin-settings";

/** Expert threshold. Admin only. Blank values delete the stored row (inherit or no threshold). */
export async function saveThresholdsAction(_prev: ValuationActionState, formData: FormData): Promise<ValuationActionState> {
  const admin = await requireRole(["ADMIN"]);
  const overrides: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("override:") || typeof value !== "string") continue;
    overrides[key.slice("override:".length)] = value;
  }
  const global = formString(formData, "global");
  const result = await saveThresholdSettings({ admin: { id: admin.id }, form: { global, overrides } });
  if (!result.ok) {
    return { ok: false, error: result.error, fieldErrors: {}, values: { global, ...prefixed(overrides) } };
  }
  revalidatePath("/admin/valuations/settings");
  return {
    ok: true,
    message: result.value.changed.length === 0 ? "No changes to save." : `Saved. Changed: ${result.value.changed.join(", ")}.`,
  };
}

function prefixed(overrides: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(overrides).map(([id, value]) => [`override:${id}`, value]));
}
