import { describe, expect, it } from "vitest";
import { buildPageHref, parseCatalogueParams } from "./query-params";

describe("parseCatalogueParams", () => {
  it("returns defaults for empty input", () => {
    const q = parseCatalogueParams({});
    expect(q.sort).toBe("newest");
    expect(q.page).toBe(1);
    expect(q.q).toBeUndefined();
    expect(q.availability).toBeUndefined();
  });

  it("drops invalid values and keeps the valid ones", () => {
    const q = parseCatalogueParams({
      sort: "cheapest-first",
      page: "abc",
      currency: "EUR",
      certified: "maybe",
      minCarat: "two",
      type: "Sapphire",
    });
    expect(q.sort).toBe("newest");
    expect(q.page).toBe(1);
    expect(q.currency).toBeUndefined();
    expect(q.certified).toBeUndefined();
    expect(q.minCarat).toBeUndefined();
    expect(q.type).toBe("Sapphire");
  });

  it("treats empty strings as not set (z.coerce would turn '' into 0)", () => {
    const q = parseCatalogueParams({ maxCarat: "", minPrice: "", maxPrice: "  ", page: "" });
    expect(q.maxCarat).toBeUndefined();
    expect(q.minPrice).toBeUndefined();
    expect(q.maxPrice).toBeUndefined();
    expect(q.page).toBe(1);
  });

  it("rejects page numbers that are not whole numbers or are out of range", () => {
    expect(parseCatalogueParams({ page: "2.5" }).page).toBe(1);
    expect(parseCatalogueParams({ page: "0" }).page).toBe(1);
    expect(parseCatalogueParams({ page: "1001" }).page).toBe(1);
    expect(parseCatalogueParams({ page: "3" }).page).toBe(3);
  });

  it("uses the first value when a parameter is repeated", () => {
    expect(parseCatalogueParams({ q: ["ruby", "sapphire"] }).q).toBe("ruby");
  });

  it("drops an inverted carat range rather than returning an empty grid", () => {
    const q = parseCatalogueParams({ minCarat: "5", maxCarat: "1" });
    expect(q.minCarat).toBeUndefined();
    expect(q.maxCarat).toBeUndefined();
  });

  it("keeps a valid carat range", () => {
    const q = parseCatalogueParams({ minCarat: "1", maxCarat: "5.5" });
    expect(q.minCarat).toBe(1);
    expect(q.maxCarat).toBe(5.5);
  });

  it("applies a forced category regardless of the URL", () => {
    expect(parseCatalogueParams({ category: "ruby" }, { category: "sapphire" }).category).toBe("sapphire");
  });

  it("ignores unknown keys", () => {
    const q = parseCatalogueParams({ admin: "1", sort: "price_asc" });
    expect(q.sort).toBe("price_asc");
    expect(q).not.toHaveProperty("admin");
  });
});

describe("buildPageHref", () => {
  it("keeps active filters and sets the page", () => {
    const q = parseCatalogueParams({ type: "Ruby", certified: "yes", sort: "price_asc" });
    const href = buildPageHref("/gemstones", q, 2);
    const params = new URLSearchParams(href.split("?")[1]);
    expect(href.startsWith("/gemstones?")).toBe(true);
    expect(params.get("type")).toBe("Ruby");
    expect(params.get("certified")).toBe("yes");
    expect(params.get("sort")).toBe("price_asc");
    expect(params.get("page")).toBe("2");
  });

  it("omits the category on category pages and leaves page 1 unparamed", () => {
    const q = parseCatalogueParams({}, { category: "ruby" });
    expect(buildPageHref("/categories/ruby", q, 1, { omit: ["category"] })).toBe("/categories/ruby");
  });
});
