"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { requireMessagingUser } from "@/lib/messaging/access";
import { type ActionResult, messageForActionError, readUploads } from "@/lib/messaging/action-helpers";
import { startGeneralConversation } from "@/lib/messaging/service";

/**
 * Starts a general conversation with a seller from their portfolio page. The seller is resolved by
 * slug on the server (approved sellers only). The client never supplies a user ID.
 */

const slugSchema = z.string().trim().min(1).max(120);

export async function contactSellerAction(
  sellerSlug: string,
  formData: FormData,
): Promise<ActionResult<{ conversationId: string; warning: string | null }>> {
  const parsedSlug = slugSchema.safeParse(sellerSlug);
  if (!parsedSlug.success) return { ok: false, error: "This seller can't be contacted right now." };

  try {
    const user = await requireMessagingUser();
    const seller = await prisma.sellerProfile.findFirst({
      where: { slug: parsedSlug.data, approvalStatus: "APPROVED" },
      select: { userId: true },
    });
    if (!seller) return { ok: false, error: "This seller can't be contacted right now." };

    const body = String(formData.get("body") ?? "");
    const files = await readUploads(formData);
    const result = await startGeneralConversation({
      userId: user.id,
      targetUserId: seller.userId,
      body,
      files,
    });
    revalidatePath("/conversations");
    return { ok: true, conversationId: result.conversationId, warning: result.warning };
  } catch (error) {
    return { ok: false, error: messageForActionError(error) };
  }
}
