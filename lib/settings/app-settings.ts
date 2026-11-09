import { prisma } from "@/lib/db/client";

/**
 * Platform settings stored in AppSetting. Each setting is typed here, so callers never
 * pass raw keys or unvalidated values around.
 */

export const SETTING_KEYS = {
  /** Admin: publish listings from APPROVED sellers without manual review. Default false. */
  autoPublishApprovedSellers: "listing.autoPublishApprovedSellers",
} as const;

export type SettingName = keyof typeof SETTING_KEYS;

const DEFAULTS: Record<SettingName, boolean> = {
  autoPublishApprovedSellers: false,
};

export async function getBooleanSetting(name: SettingName): Promise<boolean> {
  const row = await prisma.appSetting.findUnique({ where: { key: SETTING_KEYS[name] } });
  if (!row) return DEFAULTS[name];
  return row.value === true;
}

export async function setBooleanSetting(name: SettingName, value: boolean, actorId: string): Promise<void> {
  await prisma.appSetting.upsert({
    where: { key: SETTING_KEYS[name] },
    update: { value, updatedById: actorId },
    create: { key: SETTING_KEYS[name], value, updatedById: actorId },
  });
}
