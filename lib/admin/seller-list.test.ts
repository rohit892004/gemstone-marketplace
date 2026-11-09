import { describe, expect, it } from "vitest";
import { parseSellerListParams, sellerWhere } from "./seller-list";

describe("parseSellerListParams", () => {
  it("defaults to PENDING, page 1", () => {
    expect(parseSellerListParams({})).toEqual({ status: "PENDING", page: 1 });
  });

  it("accepts every known status filter", () => {
    for (const status of ["all", "APPROVED", "REJECTED", "SUSPENDED"]) {
      expect(parseSellerListParams({ status }).status).toBe(status);
    }
  });

  it("falls back to PENDING for unknown status values", () => {
    expect(parseSellerListParams({ status: "DROP TABLE" }).status).toBe("PENDING");
    expect(parseSellerListParams({ status: "approved" }).status).toBe("PENDING");
  });

  it("falls back to page 1 for bad, zero or negative pages", () => {
    expect(parseSellerListParams({ page: "abc" }).page).toBe(1);
    expect(parseSellerListParams({ page: "0" }).page).toBe(1);
    expect(parseSellerListParams({ page: "-4" }).page).toBe(1);
    expect(parseSellerListParams({ page: "2.5" }).page).toBe(1);
  });

  it("parses a valid page and uses the first value of a repeated param", () => {
    expect(parseSellerListParams({ page: "3" }).page).toBe(3);
    expect(parseSellerListParams({ status: ["APPROVED", "REJECTED"] }).status).toBe("APPROVED");
  });
});

describe("sellerWhere", () => {
  it("applies no filter for all", () => {
    expect(sellerWhere("all")).toEqual({});
  });

  it("filters by approval status otherwise", () => {
    expect(sellerWhere("SUSPENDED")).toEqual({ approvalStatus: "SUSPENDED" });
  });
});
