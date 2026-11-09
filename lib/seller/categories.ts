import { prisma } from "@/lib/db/client";
import type { CategoryOption } from "@/lib/seller/category-selection";

/**
 * The gemstone categories a seller can choose: top-level categories only, in name order.
 * Sub-categories are not offered on the application or the admin seller page.
 */
export async function loadSellerCategories(): Promise<CategoryOption[]> {
  return prisma.category.findMany({
    where: { parentId: null },
    orderBy: [{ name: "asc" }],
    select: { id: true, name: true, slug: true },
  });
}
