import { assertActiveAdmin } from "@/lib/auth/assert-admin";
import { recordAudit } from "@/lib/audit/audit";
import { AuditAction } from "@/lib/audit/actions";
import { prisma } from "@/lib/db/client";
import { VALUATION_CATEGORIES } from "./defaults";
import { parseThresholdInput, thresholdToSettingValue, type ParseResult } from "./admin-values";
import { categoryThresholdKey, EXPERT_THRESHOLD_KEY, parseThresholdSetting } from "./thresholds";

/**
 * Expert threshold settings. One global value and an optional override per category. Each is an AppSetting row
 * holding a decimal string of minor units. A blank value deletes the row, so "blank" always means "inherit"
 * (for categories) or "no threshold" (for the global value).
 */

export interface ThresholdSettings {
  global: bigint | null;
  categories: Array<{ id: string; name: string; override: bigint | null }>;
}

export async function loadThresholdSettings(): Promise<ThresholdSettings> {
  const categories = await prisma.category.findMany({
    where: { name: { in: [...VALUATION_CATEGORIES] } },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  const keys = [EXPERT_THRESHOLD_KEY, ...categories.map((c) => categoryThresholdKey(c.id))];
  const rows = await prisma.appSetting.findMany({ where: { key: { in: keys } }, select: { key: true, value: true } });
  const byKey = new Map(rows.map((r) => [r.key, r.value]));
  return {
    global: parseThresholdSetting(byKey.get(EXPERT_THRESHOLD_KEY)),
    categories: categories.map((c) => ({
      id: c.id,
      name: c.name,
      override: parseThresholdSetting(byKey.get(categoryThresholdKey(c.id))),
    })),
  };
}

export interface ThresholdForm {
  global: string;
  /** Category id to the typed override. Missing or blank means inherit. */
  overrides: Record<string, string>;
}

/**
 * Validates the whole form first. Writes only when every value is valid. Only changed values are written, and the
 * audit entry lists which keys changed (never the whole table).
 */
export async function saveThresholdSettings(input: {
  admin: { id: string };
  form: ThresholdForm;
}): Promise<ParseResult<{ changed: string[] }>> {
  await assertActiveAdmin(input.admin.id);
  const current = await loadThresholdSettings();
  const globalParsed = parseThresholdInput(input.form.global);
  if (!globalParsed.ok) return { ok: false, error: `Global threshold: ${globalParsed.error}` };

  const plan: Array<{ key: string; value: bigint | null; previous: bigint | null; label: string }> = [
    { key: EXPERT_THRESHOLD_KEY, value: globalParsed.value, previous: current.global, label: "global" },
  ];
  const categoryIds = new Set(current.categories.map((c) => c.id));
  for (const category of current.categories) {
    const typed = input.form.overrides[category.id] ?? "";
    const parsed = parseThresholdInput(typed);
    if (!parsed.ok) return { ok: false, error: `${category.name}: ${parsed.error}` };
    plan.push({
      key: categoryThresholdKey(category.id),
      value: parsed.value,
      previous: category.override,
      label: category.name,
    });
  }
  for (const id of Object.keys(input.form.overrides)) {
    if (!categoryIds.has(id)) return { ok: false, error: "Unknown category." };
  }

  const changes = plan.filter((p) => p.value !== p.previous);
  if (changes.length === 0) return { ok: true, value: { changed: [] } };

  await prisma.$transaction(
    changes.map((change) =>
      change.value === null
        ? prisma.appSetting.deleteMany({ where: { key: change.key } })
        : prisma.appSetting.upsert({
            where: { key: change.key },
            create: { key: change.key, value: thresholdToSettingValue(change.value), updatedById: input.admin.id },
            update: { value: thresholdToSettingValue(change.value), updatedById: input.admin.id },
          }),
    ),
  );

  const changed = changes.map((c) => c.label);
  await recordAudit({
    action: AuditAction.VALUATION_THRESHOLD_CHANGED,
    actorId: input.admin.id,
    entityType: "AppSetting",
    meta: { changed: changed.join(", ") },
  });
  return { ok: true, value: { changed } };
}
