import { describe, expect, it } from "vitest";
import {
  adminValuationQuery,
  adminValuationWhere,
  parseAdminValuationFilters,
  parseIsoDate,
} from "./admin-filters";
import {
  formatBpsAsPercent,
  normaliseMultiplierKey,
  parsePercentToBps,
  parseThresholdInput,
  thresholdToSettingValue,
} from "./admin-values";

describe("parseAdminValuationFilters", () => {
  it("uses safe defaults for an empty query", () => {
    const { filters, errors } = parseAdminValuationFilters({});
    expect(errors).toEqual({});
    expect(filters).toEqual({
      statuses: [],
      assignment: "all",
      source: "all",
      from: null,
      to: null,
      fromText: "",
      toText: "",
      reference: null,
      page: 1,
    });
  });

  it("keeps only known statuses and removes duplicates", () => {
    const { filters } = parseAdminValuationFilters({ status: ["NEEDS_INFO", "NEEDS_INFO", "BOGUS", "COMPLETED"] });
    expect(filters.statuses).toEqual(["NEEDS_INFO", "COMPLETED"]);
  });

  it("accepts a single repeated value passed as a string", () => {
    expect(parseAdminValuationFilters({ status: "REJECTED" }).filters.statuses).toEqual(["REJECTED"]);
  });

  it("falls back to all for unknown source values", () => {
    expect(parseAdminValuationFilters({ source: "EVERYTHING" }).filters.source).toBe("all");
    expect(parseAdminValuationFilters({ source: "LISTING" }).filters.source).toBe("LISTING");
  });

  it("treats the end date as inclusive of its whole day", () => {
    const { filters, errors } = parseAdminValuationFilters({ from: "2026-03-01", to: "2026-03-31" });
    expect(errors).toEqual({});
    expect(filters.from?.toISOString()).toBe("2026-03-01T00:00:00.000Z");
    expect(filters.to?.toISOString()).toBe("2026-04-01T00:00:00.000Z");
  });

  it("reports a bad date and drops it", () => {
    const { filters, errors } = parseAdminValuationFilters({ from: "2026-02-30" });
    expect(errors.from).toContain("YYYY-MM-DD");
    expect(filters.from).toBeNull();
    expect(filters.fromText).toBe("");
  });

  it("reports a range that ends before it starts", () => {
    const { filters, errors } = parseAdminValuationFilters({ from: "2026-05-10", to: "2026-05-01" });
    expect(errors.to).toContain("same as or after");
    expect(filters.to).toBeNull();
  });

  it("upper-cases the exact reference and caps its length", () => {
    expect(parseAdminValuationFilters({ ref: " gsv-26-k7q2m9 " }).filters.reference).toBe("GSV-26-K7Q2M9");
    expect(parseAdminValuationFilters({ ref: "x".repeat(50) }).filters.reference).toHaveLength(20);
  });

  it("validates the page number", () => {
    expect(parseAdminValuationFilters({ page: "3" }).filters.page).toBe(3);
    expect(parseAdminValuationFilters({ page: "-2" }).filters.page).toBe(1);
    expect(parseAdminValuationFilters({ page: "abc" }).filters.page).toBe(1);
  });

  it("drops an assignment value that is not an id", () => {
    expect(parseAdminValuationFilters({ assignment: "a b; drop" }).filters.assignment).toBe("all");
    expect(parseAdminValuationFilters({ assignment: "unassigned" }).filters.assignment).toBe("unassigned");
  });
});

describe("adminValuationWhere", () => {
  it("builds an empty where clause for no filters", () => {
    expect(adminValuationWhere(parseAdminValuationFilters({}).filters)).toEqual({});
  });

  it("maps each filter to its real column", () => {
    const { filters } = parseAdminValuationFilters({
      status: ["IN_EXPERT_REVIEW", "NEEDS_INFO"],
      assignment: "cval123abc",
      source: "STANDALONE",
      from: "2026-01-01",
      to: "2026-01-31",
      ref: "GSV-26-AAAAAA",
    });
    const where = adminValuationWhere(filters);
    expect(where).toEqual({
      status: { in: ["IN_EXPERT_REVIEW", "NEEDS_INFO"] },
      assignedValuatorId: "cval123abc",
      source: "STANDALONE",
      submittedAt: { gte: new Date("2026-01-01T00:00:00Z"), lt: new Date("2026-02-01T00:00:00Z") },
      reference: "GSV-26-AAAAAA",
    });
  });

  it("filters for unassigned requests", () => {
    const { filters } = parseAdminValuationFilters({ assignment: "unassigned" });
    expect(adminValuationWhere(filters)).toEqual({ assignedValuatorId: null });
  });
});

describe("adminValuationQuery", () => {
  it("keeps the other filters when paging", () => {
    const { filters } = parseAdminValuationFilters({ status: ["COMPLETED"], source: "LISTING", from: "2026-01-02" });
    expect(adminValuationQuery(filters, 2)).toBe(
      "/admin/valuations?status=COMPLETED&source=LISTING&from=2026-01-02&page=2",
    );
    expect(adminValuationQuery(filters, 1)).toBe("/admin/valuations?status=COMPLETED&source=LISTING&from=2026-01-02");
  });

  it("returns the bare path with no filters on page one", () => {
    expect(adminValuationQuery(parseAdminValuationFilters({}).filters, 1)).toBe("/admin/valuations");
  });
});

describe("parseIsoDate", () => {
  it("rejects non-dates and impossible dates", () => {
    expect(parseIsoDate("2026-13-01")).toBeNull();
    expect(parseIsoDate("2024-02-29")).not.toBeNull();
    expect(parseIsoDate("2026-2-1")).toBeNull();
  });
});

describe("percent and basis point conversion", () => {
  it("converts percentages to integer basis points", () => {
    expect(parsePercentToBps("85")).toEqual({ ok: true, value: 8500 });
    expect(parsePercentToBps("85.5")).toEqual({ ok: true, value: 8550 });
    expect(parsePercentToBps("92.25%")).toEqual({ ok: true, value: 9225 });
    expect(parsePercentToBps("100")).toEqual({ ok: true, value: 10000 });
  });

  it("refuses values that are not a percentage or are out of range", () => {
    expect(parsePercentToBps("abc").ok).toBe(false);
    expect(parsePercentToBps("85.123").ok).toBe(false);
    expect(parsePercentToBps("0").ok).toBe(false);
    expect(parsePercentToBps("301").ok).toBe(false);
    expect(parsePercentToBps("-5").ok).toBe(false);
  });

  it("formats basis points back to percentages without floats", () => {
    expect(formatBpsAsPercent(8500)).toBe("85");
    expect(formatBpsAsPercent(8550)).toBe("85.5");
    expect(formatBpsAsPercent(8505)).toBe("85.05");
    expect(formatBpsAsPercent(10000)).toBe("100");
  });

  it("round trips every whole and half percent", () => {
    for (let bps = 100; bps <= 30000; bps += 5) {
      const parsed = parsePercentToBps(formatBpsAsPercent(bps));
      expect(parsed).toEqual({ ok: true, value: bps });
    }
  });
});

describe("multiplier keys", () => {
  it("normalises case and spaces", () => {
    expect(normaliseMultiplierKey("  South   Africa ")).toEqual({ ok: true, value: "south africa" });
  });

  it("refuses empty keys and characters that are not expected", () => {
    expect(normaliseMultiplierKey("   ").ok).toBe(false);
    expect(normaliseMultiplierKey("<script>").ok).toBe(false);
  });
});

describe("expert threshold input", () => {
  it("blank means no threshold", () => {
    expect(parseThresholdInput("   ")).toEqual({ ok: true, value: null });
  });

  it("converts major units to minor units with BigInt", () => {
    expect(parseThresholdInput("250000")).toEqual({ ok: true, value: BigInt(25000000) });
    expect(parseThresholdInput("1,250.50")).toEqual({ ok: true, value: BigInt(125050) });
  });

  it("refuses zero, negatives, and too many decimals", () => {
    expect(parseThresholdInput("0").ok).toBe(false);
    expect(parseThresholdInput("-1").ok).toBe(false);
    expect(parseThresholdInput("10.005").ok).toBe(false);
  });

  it("stores the value as a decimal string of minor units", () => {
    expect(thresholdToSettingValue(BigInt(25000000))).toBe("25000000");
  });
});
