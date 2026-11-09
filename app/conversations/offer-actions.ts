"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireMessagingUser } from "@/lib/messaging/access";
import { messageForActionError, type ActionResult } from "@/lib/messaging/action-helpers";
import { parseMajorToMinor } from "@/lib/money/money";
import { sendOffer } from "@/lib/offers/send";

/**
 * Buyer offer on a listing conversation. The buyer comes from the session; the conversation ID is
 * checked for membership inside sendOffer. Amounts are typed in major units ("12,500.50") and
 * converted to minor units here before they reach the domain code.
 */

const idSchema = z.string().trim().min(1).max(64);

export async function sendOfferAction(
  conversationId: string,
  formData: FormData,
): Promise<ActionResult<{ warning: string | null }>> {
  const parsedId = idSchema.safeParse(conversationId);
  if (!parsedId.success) return { ok: false, error: "This conversation is not available." };

  const amount = parseMajorToMinor(String(formData.get("amount") ?? ""));
  if (!amount.ok) {
    return {
      ok: false,
      error:
        amount.reason === "range"
          ? "Enter a positive amount within the platform limit."
          : "Enter the amount as a number, for example 12,500 or 12,500.50.",
    };
  }

  try {
    const user = await requireMessagingUser();
    const result = await sendOffer({
      buyerId: user.id,
      conversationId: parsedId.data,
      amountMinor: amount.minor,
      currency: String(formData.get("currency") ?? ""),
      note: String(formData.get("note") ?? ""),
    });
    revalidatePath("/conversations");
    return { ok: true, warning: result.warning };
  } catch (error) {
    return { ok: false, error: messageForActionError(error) };
  }
}
