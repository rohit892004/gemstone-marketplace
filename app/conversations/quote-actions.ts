"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { commerceErrorMessage } from "@/lib/commerce/errors";
import { requireMessagingUser } from "@/lib/messaging/access";
import { createQuotation, respondToQuotation, withdrawQuotation } from "@/lib/quotations/service";

/**
 * Quotation actions: create (seller), withdraw (seller), accept and decline (buyer side).
 * The acting user comes from the session. Client IDs are resolved through conversation membership
 * inside the service, so a non-participant gets the same "not available" answer as a missing ID.
 */

type ActionResult<T extends object = object> = ({ ok: true } & T) | { ok: false; error: string };

const GENERIC = "Something went wrong. Try again.";
const NOT_FOUND = "This quotation is not available.";
const idSchema = z.string().trim().min(1).max(64);

function messageFor(error: unknown): string {
  const known = commerceErrorMessage(error);
  if (known) return known;
  console.error("[quotations] action failed", error);
  return GENERIC;
}

function field(formData: FormData, name: string, max: number): string {
  return String(formData.get(name) ?? "").slice(0, max);
}

export async function createQuotationAction(
  conversationId: string,
  formData: FormData,
): Promise<ActionResult<{ quotationId: string; warning: string | null }>> {
  const parsedId = idSchema.safeParse(conversationId);
  if (!parsedId.success) return { ok: false, error: "This conversation is not available." };
  try {
    const user = await requireMessagingUser();
    const gemstoneRaw = field(formData, "gemstoneId", 64).trim();
    const result = await createQuotation({
      conversationId: parsedId.data,
      sellerId: user.id,
      gemstoneId: gemstoneRaw || null,
      itemTitle: field(formData, "itemTitle", 200),
      quantity: field(formData, "quantity", 20),
      amount: field(formData, "amount", 40),
      currency: field(formData, "currency", 10),
      validUntil: field(formData, "validUntil", 20),
      terms: field(formData, "terms", 2000),
    });
    revalidatePath(`/conversations/${parsedId.data}`);
    revalidatePath("/seller/quotations");
    return { ok: true, quotationId: result.quotationId, warning: result.warning };
  } catch (error) {
    return { ok: false, error: messageFor(error) };
  }
}

export async function withdrawQuotationAction(quotationId: string): Promise<ActionResult<{ status: "WITHDRAWN" }>> {
  const parsedId = idSchema.safeParse(quotationId);
  if (!parsedId.success) return { ok: false, error: NOT_FOUND };
  try {
    const user = await requireMessagingUser();
    const result = await withdrawQuotation({ quotationId: parsedId.data, sellerId: user.id });
    revalidatePath(`/conversations/${result.conversationId}`);
    revalidatePath("/seller/quotations");
    return { ok: true, status: result.status };
  } catch (error) {
    return { ok: false, error: messageFor(error) };
  }
}

async function answerQuotation(quotationId: string, decision: "ACCEPT" | "DECLINE") {
  const parsedId = idSchema.safeParse(quotationId);
  if (!parsedId.success) return { ok: false as const, error: NOT_FOUND };
  try {
    const user = await requireMessagingUser();
    const result = await respondToQuotation({ quotationId: parsedId.data, buyerId: user.id, decision });
    revalidatePath(`/conversations/${result.conversationId}`);
    return { ok: true as const, status: result.status };
  } catch (error) {
    return { ok: false as const, error: messageFor(error) };
  }
}

export async function acceptQuotationAction(quotationId: string): Promise<ActionResult<{ status: "ACCEPTED" | "DECLINED" }>> {
  return answerQuotation(quotationId, "ACCEPT");
}

export async function declineQuotationAction(quotationId: string): Promise<ActionResult<{ status: "ACCEPTED" | "DECLINED" }>> {
  return answerQuotation(quotationId, "DECLINE");
}
