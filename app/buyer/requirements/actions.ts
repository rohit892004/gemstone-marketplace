"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/require-role";
import { messageForActionError } from "@/lib/messaging/action-helpers";
import { RequirementError, closeRequirement, postRequirement, updateRequirement } from "@/lib/requirements/service";
import { requirementRawFromFormData, type RequirementField } from "@/lib/requirements/validate";

/**
 * Buyer requirement actions. Buyer role only; the buyer comes from the session. Every write is
 * scoped to that buyer, so a requirement ID from the client only works for the owner.
 */

export type RequirementActionResult =
  | { ok: true; requirementId: string; warning: string | null }
  | { ok: false; error: string; fieldErrors?: Partial<Record<RequirementField, string>> };

const idSchema = z.string().trim().min(1).max(64);
const NOT_FOUND = "This requirement is not available.";

function fail(error: unknown): RequirementActionResult {
  if (error instanceof RequirementError) {
    return { ok: false, error: error.message, fieldErrors: error.fieldErrors };
  }
  return { ok: false, error: messageForActionError(error) };
}

export async function postRequirementAction(formData: FormData): Promise<RequirementActionResult> {
  try {
    const user = await requireRole(["BUYER"]);
    const result = await postRequirement({ buyerId: user.id, raw: requirementRawFromFormData(formData) });
    revalidatePath("/buyer/requirements");
    return { ok: true, requirementId: result.requirementId, warning: result.warning };
  } catch (error) {
    return fail(error);
  }
}

export async function updateRequirementAction(requirementId: string, formData: FormData): Promise<RequirementActionResult> {
  const parsed = idSchema.safeParse(requirementId);
  if (!parsed.success) return { ok: false, error: NOT_FOUND };
  try {
    const user = await requireRole(["BUYER"]);
    const result = await updateRequirement({
      buyerId: user.id,
      requirementId: parsed.data,
      raw: requirementRawFromFormData(formData),
    });
    revalidatePath("/buyer/requirements");
    revalidatePath(`/buyer/requirements/${parsed.data}`);
    return { ok: true, requirementId: parsed.data, warning: result.warning };
  } catch (error) {
    return fail(error);
  }
}

export async function closeRequirementAction(requirementId: string): Promise<RequirementActionResult> {
  const parsed = idSchema.safeParse(requirementId);
  if (!parsed.success) return { ok: false, error: NOT_FOUND };
  try {
    const user = await requireRole(["BUYER"]);
    await closeRequirement({ buyerId: user.id, requirementId: parsed.data });
    revalidatePath("/buyer/requirements");
    revalidatePath(`/buyer/requirements/${parsed.data}`);
    return { ok: true, requirementId: parsed.data, warning: null };
  } catch (error) {
    return fail(error);
  }
}
