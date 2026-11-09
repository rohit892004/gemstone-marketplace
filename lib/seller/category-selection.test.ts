import { describe, expect, it } from "vitest";
import { MAX_CATEGORY_VALUES, selectSellerCategories, type CategoryOption } from "./category-selection";

const options: CategoryOption[] = [
  { id: "cat_diamond", name: "Diamond", slug: "diamond" },
  { id: "cat_ruby", name: "Ruby", slug: "ruby" },
  { id: "cat_sapphire", name: "Sapphire", slug: "sapphire" },
];

describe("selectSellerCategories", () => {
  it("accepts one category", () => {
    expect(selectSellerCategories(["cat_ruby"], options)).toEqual({ ok: true, ids: ["cat_ruby"] });
  });

  it("returns several categories in the option order, not the submitted order", () => {
    expect(selectSellerCategories(["cat_sapphire", "cat_diamond"], options)).toEqual({
      ok: true,
      ids: ["cat_diamond", "cat_sapphire"],
    });
  });

  it("collapses duplicates and drops blank values", () => {
    expect(selectSellerCategories(["cat_ruby", "  ", "cat_ruby", ""], options)).toEqual({
      ok: true,
      ids: ["cat_ruby"],
    });
  });

  it("requires at least one category", () => {
    const result = selectSellerCategories([], options);
    expect(result).toEqual({ ok: false, error: "Choose at least one gemstone category" });
  });

  it("requires at least one category when only blanks are sent", () => {
    expect(selectSellerCategories(["   "], options).ok).toBe(false);
  });

  it("refuses an id that is not in the offered list, even alongside valid ones", () => {
    expect(selectSellerCategories(["cat_ruby", "cat_other"], options)).toEqual({
      ok: false,
      error: "Choose categories from the list",
    });
  });

  it("refuses everything when no categories are offered", () => {
    const result = selectSellerCategories(["cat_ruby"], []);
    expect(result.ok).toBe(false);
  });

  it("matches ids exactly, not by name or slug", () => {
    expect(selectSellerCategories(["Ruby"], options).ok).toBe(false);
    expect(selectSellerCategories(["ruby"], options).ok).toBe(false);
  });

  it("only looks at the first values up to the limit", () => {
    const flood = Array.from({ length: MAX_CATEGORY_VALUES + 5 }, (_, i) => `junk_${i}`);
    // Junk beyond the limit is never read, so a valid id placed after it is ignored.
    expect(selectSellerCategories([...flood, "cat_ruby"], options).ok).toBe(false);
    expect(selectSellerCategories(["cat_ruby", ...flood], options).ok).toBe(false);
  });
});
