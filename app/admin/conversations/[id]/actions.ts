"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { conversationReasonSchema, idSchema } from "@/lib/admin-moderation/schemas";
import {
  encodeViewReason,
  VIEW_WINDOW_SECONDS,
  viewCookieName,
  viewCookiePath,
} from "@/lib/admin-moderation/conversation-view";
import type { AdminActionState } from "@/lib/admin/action-state";
import { requireRole } from "@/lib/auth/require-role";
import { getEnv } from "@/lib/config/env";
import { prisma } from "@/lib/db/client";

/**
 * Starts an audited conversation view. This action does NOT read the conversation. It checks the
 * reason and stores it in a short-lived, path-scoped cookie, then redirects to the viewer page.
 * The viewer page calls viewConversationAsAdmin() on every load, and that call writes the audit
 * row. So the audit is written by the read itself, and a refresh writes another row.
 */

function formValue(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export async function beginConversationView(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  await requireRole(["ADMIN"]);
  const parsed = conversationReasonSchema.safeParse({
    conversationId: formValue(formData, "conversationId"),
    reason: formValue(formData, "reason"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const { conversationId, reason } = parsed.data;
  const exists = await prisma.conversation.findUnique({ where: { id: conversationId }, select: { id: true } });
  if (!exists) return { ok: false, error: "Conversation not found." };

  const store = await cookies();
  store.set(viewCookieName(conversationId), encodeViewReason(reason), {
    httpOnly: true,
    sameSite: "strict",
    secure: getEnv().NODE_ENV === "production",
    path: viewCookiePath(conversationId),
    maxAge: VIEW_WINDOW_SECONDS,
  });
  redirect(viewCookiePath(conversationId));
}

/** Clears the stored reason, so the next load asks for a new one. */
export async function endConversationView(formData: FormData): Promise<void> {
  await requireRole(["ADMIN"]);
  const parsed = idSchema.safeParse(formValue(formData, "conversationId"));
  if (!parsed.success) redirect("/admin/moderation");

  const conversationId = parsed.data;
  const store = await cookies();
  store.set(viewCookieName(conversationId), "", {
    httpOnly: true,
    sameSite: "strict",
    secure: getEnv().NODE_ENV === "production",
    path: viewCookiePath(conversationId),
    maxAge: 0,
  });
  redirect(viewCookiePath(conversationId));
}
