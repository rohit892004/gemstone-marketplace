/**
 * Gemstone category selection for seller applications and the admin seller page.
 * Pure: the caller supplies the allowed options (top-level categories, see lib/seller/categories.ts).
 *
 * Rules:
 *  - Only top-level categories (parentId null) can be chosen.
 *  - At least one category is required.
 *  - Duplicates and blank values are dropped. The result follows the option order, so stored
 *    selections are stable whatever order the browser sent them in.
 */

export interface CategoryOption {
  id: string;
  name: string;
  slug: string;
}

/** A form can send at most this many category values. Far above the real list size. */
export const MAX_CATEGORY_VALUES = 100;

export type CategorySelection = { ok: true; ids: string[] } | { ok: false; error: string };

export function selectSellerCategories(
  submitted: readonly string[],
  options: readonly CategoryOption[],
): CategorySelection {
  if (options.length === 0) {
    return { ok: false, error: "No gemstone categories are available yet. Try again later." };
  }

  const wanted = new Set(
    submitted
      .slice(0, MAX_CATEGORY_VALUES)
      .map((value) => value.trim())
      .filter((value) => value.length > 0),
  );
  const allowed = new Set(options.map((option) => option.id));
  for (const id of wanted) {
    if (!allowed.has(id)) return { ok: false, error: "Choose categories from the list" };
  }
  if (wanted.size === 0) return { ok: false, error: "Choose at least one gemstone category" };

  return { ok: true, ids: options.filter((option) => wanted.has(option.id)).map((option) => option.id) };
}
