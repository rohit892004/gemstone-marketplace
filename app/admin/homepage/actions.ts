"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { CATALOGUE_AUDIT, recordCatalogueAudit } from "@/lib/admin-catalogue/audit";
import type { AdminActionState } from "@/lib/admin/action-state";
import { requireRole } from "@/lib/auth/require-role";
import { prisma } from "@/lib/db/client";
import { HOMEPAGE_BLOCK_KEYS, homepageBlockSchemas, isHomepageBlockKey } from "@/lib/homepage/blocks";
import { getClientIp } from "@/lib/security/client-ip";

/**
 * Homepage block editor. The form posts one block at a time. Fields are read only for the block's
 * known keys, then validated by that block's strict schema. Saved as an upsert by key.
 */

function formValue(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export async function saveHomepageBlock(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const admin = await requireRole(["ADMIN"]);
  const key = formValue(formData, "blockKey");
  if (!isHomepageBlockKey(key)) return { ok: false, error: "Unknown homepage block." };

  const schema = homepageBlockSchemas[key];
  // Only fields the schema knows are read from the form.
  const fieldNames = Object.keys(schema.shape);
  const content: Record<string, string> = {};
  for (const name of fieldNames) content[name] = formValue(formData, name);

  const parsed = schema.safeParse(content);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const index = HOMEPAGE_BLOCK_KEYS.indexOf(key);
  await prisma.homepageBlock.upsert({
    where: { key },
    update: { content: parsed.data, active: true },
    create: { key, content: parsed.data, sortOrder: index, active: true },
  });

  await recordCatalogueAudit({
    action: CATALOGUE_AUDIT.HOMEPAGE_BLOCK_CHANGED,
    actorId: admin.id,
    entityType: "HomepageBlock",
    entityId: key,
    ip: getClientIp(await headers()),
    meta: { key, fields: fieldNames.length },
  });

  revalidatePath("/");
  revalidatePath("/admin/homepage");
  return { ok: true, message: "Saved. The homepage shows the new text." };
}
