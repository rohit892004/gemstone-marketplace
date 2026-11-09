"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { auditInTransaction, SELLER_CATEGORIES_CHANGED, transactionFailure } from "@/lib/admin-moderation/audit";
import { idSchema } from "@/lib/admin-moderation/schemas";
import type { AdminActionState } from "@/lib/admin/action-state";
import { requireRole } from "@/lib/auth/require-role";
import { prisma } from "@/lib/db/client";
import { MAX_CATEGORY_VALUES, selectSellerCategories } from "@/lib/seller/category-selection";
import { loadSellerCategories } from "@/lib/seller/categories";
import { getClientIp } from "@/lib/security/client-ip";

/**
 * Admin change of a seller's gemstone categories. Allowed in any approval status: pending and
 * rejected sellers keep their categories, and the admin can correct them at any time.
 * At least one category is required, the same rule as the application form. The change and its
 * audit row (added and removed category slugs) commit together.
 */

function formValue(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export async function updateSellerCategories(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const admin = await requireRole(["ADMIN"]);
  const parsedId = idSchema.safeParse(formValue(formData, "sellerId"));
  if (!parsedId.success) return { ok: false, error: "Invalid seller." };
  const sellerId = parsedId.data;

  const submitted = formData
    .getAll("categoryIds")
    .filter((value): value is string => typeof value === "string")
    .slice(0, MAX_CATEGORY_VALUES);

  const options = await loadSellerCategories();
  const selection = selectSellerCategories(submitted, options);
  if (!selection.ok) return { ok: false, error: selection.error };

  const seller = await prisma.sellerProfile.findUnique({
    where: { id: sellerId },
    select: { categories: { select: { id: true, slug: true } } },
  });
  if (!seller) return { ok: false, error: "Seller not found." };

  const before = new Set(seller.categories.map((category) => category.id));
  const after = new Set(selection.ids);
  const slugById = new Map(options.map((option) => [option.id, option.slug]));
  const added = selection.ids.filter((id) => !before.has(id)).map((id) => slugById.get(id) ?? id);
  const removed = seller.categories
    .filter((category) => !after.has(category.id))
    .map((category) => category.slug);

  const ip = getClientIp(await headers());
  try {
    await prisma.$transaction(async (tx) => {
      await tx.sellerProfile.update({
        where: { id: sellerId },
        data: { categories: { set: selection.ids.map((id) => ({ id })) } },
      });
      await auditInTransaction(tx, {
        action: SELLER_CATEGORIES_CHANGED,
        actorId: admin.id,
        entityType: "SellerProfile",
        entityId: sellerId,
        ip,
        meta: { added: added.join(",") || "none", removed: removed.join(",") || "none", count: selection.ids.length },
      });
    });
  } catch (error) {
    return transactionFailure(error, "seller category change");
  }

  revalidatePath(`/admin/sellers/${sellerId}`);
  return { ok: true, message: "Categories saved." };
}
