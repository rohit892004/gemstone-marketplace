"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { AdminActionState } from "@/lib/admin/action-state";
import { requireRole } from "@/lib/auth/require-role";
import { clearTierOverride, MembershipError, saveTierRules, setTierOverride, type TierRuleInput } from "@/lib/membership/service";
import { TIERS, type Tier } from "@/lib/membership/tiers";

/**
 * Admin membership actions. Every action checks the admin role on the server, validates its input, and reports
 * problems as plain text. The membership service audits each change.
 */

const sellerIdSchema = z.string().min(1).max(64);
const reasonSchema = z.string().trim().min(5, "Give a reason of at least 5 characters.").max(500, "Use at most 500 characters.");

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function setTierOverrideAction(_previous: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const admin = await requireRole(["ADMIN"]);
  const sellerId = sellerIdSchema.safeParse(text(formData, "sellerId"));
  if (!sellerId.success) return { ok: false, error: "Seller not found." };
  const tier = z.enum(TIERS).safeParse(text(formData, "tier"));
  if (!tier.success) return { ok: false, error: "Choose a tier." };
  const reason = reasonSchema.safeParse(text(formData, "reason"));
  if (!reason.success) return { ok: false, error: reason.error.issues[0]?.message ?? "Give a reason." };

  try {
    await setTierOverride({ adminId: admin.id, adminRole: admin.role, sellerId: sellerId.data, tier: tier.data, reason: reason.data });
  } catch (error) {
    if (error instanceof MembershipError) return { ok: false, error: error.message };
    throw error;
  }
  revalidatePath("/admin/memberships");
  return { ok: true, message: `Tier set to ${tier.data.toLowerCase()}. The reason is in the audit log.` };
}

export async function clearTierOverrideAction(_previous: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const admin = await requireRole(["ADMIN"]);
  const sellerId = sellerIdSchema.safeParse(text(formData, "sellerId"));
  if (!sellerId.success) return { ok: false, error: "Seller not found." };
  try {
    await clearTierOverride({ adminId: admin.id, adminRole: admin.role, sellerId: sellerId.data });
  } catch (error) {
    if (error instanceof MembershipError) return { ok: false, error: error.message };
    throw error;
  }
  revalidatePath("/admin/memberships");
  return { ok: true, message: "Override cleared. The tier follows the rules again at the next review." };
}

/** Reads a whole-number field. Blank is null when allowed, otherwise an error naming the field. */
function wholeNumber(raw: string, label: string, blankIsNull: boolean): number | null {
  const value = raw.trim();
  if (value === "") {
    if (blankIsNull) return null;
    throw new MembershipError("INVALID", `${label} is required.`);
  }
  if (!/^-?\d+$/.test(value)) throw new MembershipError("INVALID", `${label} must be a whole number.`);
  return Number(value);
}

function decimal(raw: string, label: string): number | null {
  const value = raw.trim();
  if (value === "") return null;
  if (!/^\d+(\.\d{1,2})?$/.test(value)) throw new MembershipError("INVALID", `${label} must be a number with up to two decimal places.`);
  return Number(value);
}

/** Reads the rule table. Field names are `${tier}.${field}`, so one form posts all three tiers. */
function parseTierRules(formData: FormData): TierRuleInput[] {
  return TIERS.map((tier: Tier) => {
    const f = (name: string) => text(formData, `${tier}.${name}`);
    const label = (name: string) => `${tier.charAt(0)}${tier.slice(1).toLowerCase()} ${name}`;
    return {
      tier,
      activeListingLimit: wholeNumber(f("activeListingLimit"), label("listing limit"), true),
      featuredSlots: wholeNumber(f("featuredSlots"), label("featured slots"), false) ?? 0,
      analyticsDays: wholeNumber(f("analyticsDays"), label("analytics days"), false) ?? 0,
      hasBadge: formData.get(`${tier}.hasBadge`) === "on",
      rankingBoost: wholeNumber(f("rankingBoost"), label("ranking boost"), false) ?? 0,
      unlockReferrals: wholeNumber(f("unlockReferrals"), label("referrals to unlock"), true),
      unlockFollowers: wholeNumber(f("unlockFollowers"), label("followers to unlock"), true),
      minResponseRate: wholeNumber(f("minResponseRate"), label("response rate"), false) ?? 0,
      minRating: decimal(f("minRating"), label("minimum rating")),
    };
  });
}

export async function saveTierRulesAction(_previous: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const admin = await requireRole(["ADMIN"]);
  try {
    const rules = parseTierRules(formData);
    await saveTierRules({ adminId: admin.id, adminRole: admin.role, rules });
  } catch (error) {
    if (error instanceof MembershipError) return { ok: false, error: error.message };
    throw error;
  }
  revalidatePath("/admin/memberships/rules");
  revalidatePath("/admin/memberships");
  return { ok: true, message: "Tier rules saved. The seller pages show the new values." };
}
