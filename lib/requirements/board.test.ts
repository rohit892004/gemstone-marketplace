import { describe, expect, it, vi } from "vitest";
import { buildBoardWhere, parseBoardFilters } from "./board";

vi.mock("@/lib/db/client", () => ({ prisma: {} }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("next/server", () => ({ connection: async () => undefined }));
vi.mock("@/lib/auth/auth", () => ({ auth: vi.fn(async () => null) }));

const NOW = new Date("2026-11-09T06:00:00.000Z");

describe("parseBoardFilters", () => {
  it("defaults to INR and no filters", () => {
    const { filters, errors } = parseBoardFilters({});
    expect(filters).toEqual({ currency: "INR" });
    expect(errors).toEqual([]);
  });

  it("parses every filter and swaps reversed carat and budget ranges", () => {
    const { filters, errors } = parseBoardFilters({
      category: "cat_1",
      type: " Sapphire ",
      caratMin: "5",
      caratMax: "2.5",
      budgetMin: "900000",
      budgetMax: "50000",
      currency: "usd",
      certificate: "yes",
      deadlineBy: "2026-12-01",
    });
    expect(errors).toEqual([]);
    expect(filters.categoryId).toBe("cat_1");
    expect(filters.gemstoneType).toBe("Sapphire");
    expect(filters.caratMin).toBe("2.5");
    expect(filters.caratMax).toBe("5");
    expect(filters.budgetMinMinor).toBe(BigInt(5000000));
    expect(filters.budgetMaxMinor).toBe(BigInt(90000000));
    expect(filters.currency).toBe("USD");
    expect(filters.certificateNeeded).toBe(true);
    expect(filters.deadlineBy?.toISOString()).toBe("2026-12-01T23:59:59.999Z");
  });

  it("reports bad values and drops them", () => {
    const { filters, errors } = parseBoardFilters({ caratMin: "lots", budgetMax: "a lot", deadlineBy: "soon" });
    expect(filters.caratMin).toBeUndefined();
    expect(filters.budgetMaxMinor).toBeUndefined();
    expect(filters.deadlineBy).toBeUndefined();
    expect(errors).toHaveLength(3);
  });
});

describe("buildBoardWhere", () => {
  it("is always OPEN, in the seller's categories, and not past deadline", () => {
    const where = buildBoardWhere({ currency: "INR" }, "seller_1", ["cat_a", "cat_b"], NOW);
    expect(where.status).toBe("OPEN");
    expect(where.categoryId).toEqual({ in: ["cat_a", "cat_b"] });
    expect(JSON.stringify(where.AND)).toContain("2026-11-09T06:00:00.000Z");
  });

  it("narrows to one category only when the seller owns it", () => {
    expect(buildBoardWhere({ currency: "INR", categoryId: "cat_b" }, "seller_1", ["cat_a", "cat_b"], NOW).categoryId).toEqual({
      in: ["cat_b"],
    });
    expect(buildBoardWhere({ currency: "INR", categoryId: "cat_x" }, "seller_1", ["cat_a"], NOW).categoryId).toEqual({ in: ["cat_a"] });
  });

  it("matches no requirements when the seller has no categories", () => {
    expect(buildBoardWhere({ currency: "INR" }, "seller_1", [], NOW).categoryId).toEqual({ in: [] });
  });

  it("adds the carat and budget overlap clauses, and the currency for budgets", () => {
    const where = buildBoardWhere(
      {
        currency: "USD",
        caratMin: "2",
        caratMax: "4",
        budgetMinMinor: BigInt(100),
        budgetMaxMinor: BigInt(900),
      },
      "seller_1", ["cat_a"],
      NOW,
    );
    const clauses = JSON.stringify(where.AND, (_key, value: unknown) => (typeof value === "bigint" ? value.toString() : value));
    expect(clauses).toContain('"caratMax":{"gte":"2"}');
    expect(clauses).toContain('"caratMin":{"lte":"4"}');
    expect(clauses).toContain('"budgetMaxMinor":{"gte":"100"}');
    expect(clauses).toContain('"budgetMinMinor":{"lte":"900"}');
    expect(clauses).toContain('"currency":"USD"');
  });

  it("filters to certificate-needed requirements and to deadlines on or before a date", () => {
    const deadlineBy = new Date("2026-12-01T23:59:59.999Z");
    const clauses = JSON.stringify(buildBoardWhere({ currency: "INR", certificateNeeded: true, deadlineBy }, "seller_1", ["cat_a"], NOW).AND);
    expect(clauses).toContain('"certificateNeeded":true');
    expect(clauses).toContain('"deadline":{"lte":"2026-12-01T23:59:59.999Z"}');
  });

  it("never selects buyer contact fields", () => {
    const where = buildBoardWhere({ currency: "INR" }, "seller_1", ["cat_a"], NOW);
    expect(JSON.stringify(where)).not.toMatch(/email|mobile|name/i);
  });

  it("excludes the viewing seller's own requirements, even when they are open in a matching category", () => {
    const where = buildBoardWhere({ currency: "INR" }, "seller_1", ["cat_a"], NOW);
    expect(where.AND).toEqual(expect.arrayContaining([{ buyerId: { not: "seller_1" } }]));
  });

  it("keeps the exclusion when filters are applied", () => {
    const where = buildBoardWhere({ currency: "USD", caratMin: "1", certificateNeeded: true }, "seller_1", ["cat_a"], NOW);
    expect(where.AND).toEqual(expect.arrayContaining([{ buyerId: { not: "seller_1" } }]));
  });
});
