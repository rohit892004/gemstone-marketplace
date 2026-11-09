"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { CATALOGUE_AUDIT, recordCatalogueAudit } from "@/lib/admin-catalogue/audit";
import { autoPublishSchema } from "@/lib/admin-catalogue/schemas";
import type { AdminActionState } from "@/lib/admin/action-state";
import { requireRole } from "@/lib/auth/require-role";
import { getBooleanSetting, setBooleanSetting } from "@/lib/settings/app-settings";
import { getClientIp } from "@/lib/security/client-ip";

/**
 * Auto-publish for approved sellers. Affects FUTURE submissions only (read at submit time by the
 * seller flow). Turning it on does not publish existing PENDING_REVIEW listings.
 */
export async function saveAutoPublishSetting(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const admin = await requireRole(["ADMIN"]);
  const raw = formData.get("autoPublish");
  const parsed = autoPublishSchema.safeParse({ autoPublish: raw === "on" ? "on" : "off" });
  if (!parsed.success) return { ok: false, error: "Invalid input." };

  const previous = await getBooleanSetting("autoPublishApprovedSellers");
  const next = parsed.data.autoPublish;
  if (previous === next) return { ok: true, message: "No change. The setting is already " + (next ? "on." : "off.") };

  await setBooleanSetting("autoPublishApprovedSellers", next, admin.id);

  await recordCatalogueAudit({
    action: CATALOGUE_AUDIT.SETTING_CHANGED,
    actorId: admin.id,
    entityType: "AppSetting",
    entityId: "listing.autoPublishApprovedSellers",
    ip: getClientIp(await headers()),
    meta: { setting: "autoPublishApprovedSellers", oldValue: previous, newValue: next },
  });

  revalidatePath("/admin/settings");
  return {
    ok: true,
    message: next
      ? "Auto-publish is on. Future submissions from approved sellers go live without review."
      : "Auto-publish is off. Submissions go to the review queue.",
  };
}
