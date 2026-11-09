"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { commerceErrorMessage, CommerceError } from "@/lib/commerce/errors";
import { requireMessagingUser } from "@/lib/messaging/access";
import { respondToRequirement } from "@/lib/requirements/respond";

type ActionResult<T extends object = object> =
  | ({ ok: true } & T)
  | { ok: false; error: string; conversationId?: string };

const GENERIC = "Something went wrong. Try again.";
const idSchema = z.string().trim().min(1).max(64);

/**
 * Seller response to a requirement. Only approved sellers in the matching categories can respond
 * (checked in respondToRequirement). The first message is sent through the shared messaging service.
 */
export async function respondToRequirementAction(
  requirementId: string,
  formData: FormData,
): Promise<ActionResult<{ conversationId: string; warning: string | null }>> {
  const parsedId = idSchema.safeParse(requirementId);
  if (!parsedId.success) return { ok: false, error: "This requirement is not available." };
  try {
    const user = await requireMessagingUser();
    const result = await respondToRequirement({
      requirementId: parsedId.data,
      sellerId: user.id,
      body: String(formData.get("body") ?? "").slice(0, 2500),
    });
    revalidatePath("/seller/requirements");
    revalidatePath(`/seller/requirements/${parsedId.data}`);
    revalidatePath("/seller/inbox");
    return { ok: true, conversationId: result.conversationId, warning: result.warning };
  } catch (error) {
    const known = commerceErrorMessage(error);
    if (known) {
      const conversationId = error instanceof CommerceError ? error.conversationId : undefined;
      return { ok: false, error: known, conversationId };
    }
    console.error("[requirements] respond action failed", error);
    return { ok: false, error: GENERIC };
  }
}
