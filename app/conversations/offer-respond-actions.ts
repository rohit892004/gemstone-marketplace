"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { commerceErrorMessage } from "@/lib/commerce/errors";
import { requireMessagingUser } from "@/lib/messaging/access";
import { counterOffer, respondToOffer } from "@/lib/offers/respond";

/**
 * Offer responses: accept, decline or counter. Only the non-proposer can answer, and only while PENDING.
 * Offer sending belongs to the buyer offer actions (app/conversations/offer-actions.ts), not this file.
 */

type ActionResult<T extends object = object> = ({ ok: true } & T) | { ok: false; error: string };

const GENERIC = "Something went wrong. Try again.";
const NOT_FOUND = "This offer is not available.";
const idSchema = z.string().trim().min(1).max(64);

function messageFor(error: unknown): string {
  const known = commerceErrorMessage(error);
  if (known) return known;
  console.error("[offers] respond action failed", error);
  return GENERIC;
}

async function decide(offerId: string, decision: "ACCEPT" | "DECLINE") {
  const parsedId = idSchema.safeParse(offerId);
  if (!parsedId.success) return { ok: false as const, error: NOT_FOUND };
  try {
    const user = await requireMessagingUser();
    const result = await respondToOffer({ offerId: parsedId.data, responderId: user.id, decision });
    revalidatePath(`/conversations/${result.conversationId}`);
    return { ok: true as const, status: result.status };
  } catch (error) {
    return { ok: false as const, error: messageFor(error) };
  }
}

export async function acceptOfferAction(offerId: string): Promise<ActionResult<{ status: "ACCEPTED" | "DECLINED" }>> {
  return decide(offerId, "ACCEPT");
}

export async function declineOfferAction(offerId: string): Promise<ActionResult<{ status: "ACCEPTED" | "DECLINED" }>> {
  return decide(offerId, "DECLINE");
}

export async function counterOfferAction(
  offerId: string,
  formData: FormData,
): Promise<ActionResult<{ conversationId: string; warning: string | null }>> {
  const parsedId = idSchema.safeParse(offerId);
  if (!parsedId.success) return { ok: false, error: NOT_FOUND };
  try {
    const user = await requireMessagingUser();
    const result = await counterOffer({
      offerId: parsedId.data,
      responderId: user.id,
      amount: String(formData.get("amount") ?? "").slice(0, 40),
      note: String(formData.get("note") ?? "").slice(0, 1000),
    });
    revalidatePath(`/conversations/${result.conversationId}`);
    return { ok: true, conversationId: result.conversationId, warning: result.warning };
  } catch (error) {
    return { ok: false, error: messageFor(error) };
  }
}
