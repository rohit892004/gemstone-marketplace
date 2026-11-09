import { describe, expect, it } from "vitest";
import { listingRejectSchema, parseListingFilters, listingWhere } from "./schemas";

describe("listingRejectSchema", () => {
  it("requires a reason of at least 10 characters", () => {
    expect(listingRejectSchema.safeParse({ listingId: "g1", reason: "too short" }).success).toBe(false);
    expect(listingRejectSchema.safeParse({ listingId: "g1", reason: "Photos are blurred." }).success).toBe(true);
  });
});

describe("parseListingFilters", () => {
  it("falls back to defaults for unknown values", () => {
    expect(parseListingFilters({ status: "DROP", availability: "x", featured: "maybe", page: "-3" })).toEqual({
      status: "all",
      availability: "all",
      featured: "all",
      seller: "",
      page: 1,
    });
  });

  it("builds a where clause from valid filters", () => {
    const filters = parseListingFilters({ status: "PUBLISHED", featured: "yes", seller: "Gem" });
    expect(listingWhere(filters)).toEqual({
      status: "PUBLISHED",
      featured: true,
      seller: { businessName: { contains: "Gem", mode: "insensitive" } },
    });
  });
});
