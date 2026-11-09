"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireMessagingUser } from "@/lib/messaging/access";
import { type ActionResult, messageForActionError, readUploads } from "@/lib/messaging/action-helpers";
import { startEnquiry } from "@/lib/messaging/service";

/**
 * Starts (or continues) the enquiry for a listing. The buyer or seller comes from the session.
 * The listing must be publicly visible; startEnquiry refuses a seller's own listing.
 */

const idSchema = z.string().trim().min(1).max(64);

export async function startEnquiryAction(
  gemstoneId: string,
  formData: FormData,
): Promise<ActionResult<{ conversationId: string; warning: string | null }>> {
  const parsedId = idSchema.safeParse(gemstoneId);
  if (!parsedId.success) return { ok: false, error: "This gemstone is no longer available to enquire about." };

  try {
    const user = await requireMessagingUser();
    const body = String(formData.get("body") ?? "");
    const files = await readUploads(formData);
    const result = await startEnquiry({ buyerId: user.id, gemstoneId: parsedId.data, body, files });
    revalidatePath("/conversations");
    return { ok: true, conversationId: result.conversationId, warning: result.warning };
  } catch (error) {
    return { ok: false, error: messageForActionError(error) };
  }
}
