import { describe, expect, it } from "vitest";
import { LISTINGS_PAGE_SIZE, pageCount, pageWindow, parseListingsQuery } from "./listings-query";

describe("parseListingsQuery", () => {
  it("defaults to all statuses on page 1", () => {
    expect(parseListingsQuery({})).toEqual({ status: "ALL", page: 1 });
  });

  it("accepts a known status filter", () => {
    expect(parseListingsQuery({ status: "PENDING_REVIEW", page: "3" })).toEqual({ status: "PENDING_REVIEW", page: 3 });
  });

  it("drops unknown statuses and bad pages back to the defaults", () => {
    expect(parseListingsQuery({ status: "DELETED", page: "-4" })).toEqual({ status: "ALL", page: 1 });
    expect(parseListingsQuery({ status: "PUBLISHED", page: "abc" })).toEqual({ status: "PUBLISHED", page: 1 });
  });

  it("uses the first value when a param repeats", () => {
    expect(parseListingsQuery({ status: ["DRAFT", "SOLD"] })).toEqual({ status: "DRAFT", page: 1 });
  });
});

describe("pagination", () => {
  it("uses 25 per page", () => {
    expect(LISTINGS_PAGE_SIZE).toBe(25);
    expect(pageCount(0)).toBe(1);
    expect(pageCount(25)).toBe(1);
    expect(pageCount(26)).toBe(2);
  });

  it("clamps a requested page beyond the last page", () => {
    expect(pageWindow(9, 30)).toEqual({ page: 2, pages: 2, skip: 25, take: 25 });
  });

  it("computes skip for a middle page", () => {
    expect(pageWindow(2, 80)).toEqual({ page: 2, pages: 4, skip: 25, take: 25 });
  });
});
