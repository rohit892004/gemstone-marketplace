"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/require-role";
import { markNotificationsRead, saveNotificationPrefs } from "@/lib/notifications/service";

/** The signed-in user always comes from requireRole. No user id is read from the form. */
const MESSAGING_ROLES = ["BUYER", "SELLER"] as const;

export type PreferencesActionState = { ok: true; message: string } | { ok: false; error: string } | null;

const idsSchema = z.array(z.string().min(1).max(64)).max(200);

/**
 * Marks notifications read. With no ids, marks all of the user's unread notifications.
 * Ids are matched against the signed-in user's own rows, so another user's id does nothing.
 */
export async function markRead(formData: FormData): Promise<void> {
  const user = await requireRole(MESSAGING_ROLES);
  const parsed = idsSchema.safeParse(formData.getAll("id").filter((v): v is string => typeof v === "string"));
  if (!parsed.success) return;
  const ids = parsed.data.length > 0 ? parsed.data : undefined;
  await markNotificationsRead(user.id, ids);
  revalidatePath("/notifications");
}

/** Saves the signed-in user's notification preferences. Unchecked boxes arrive as absent fields. */
export async function savePreferences(
  _prev: PreferencesActionState,
  formData: FormData,
): Promise<PreferencesActionState> {
  const user = await requireRole(MESSAGING_ROLES);
  const next = {
    emailEnabled: formData.get("emailEnabled") === "on",
    enquiries: formData.get("enquiries") === "on",
    messages: formData.get("messages") === "on",
    offersAndQuotes: formData.get("offersAndQuotes") === "on",
    requirements: formData.get("requirements") === "on",
  };
  try {
    await saveNotificationPrefs(user.id, next);
  } catch {
    return { ok: false, error: "We could not save your preferences. Try again." };
  }
  revalidatePath("/notifications/preferences");
  return { ok: true, message: "Preferences saved." };
}
