import { describe, expect, it } from "vitest";
import { formatBudgetRange, formatCaratRange } from "./format";

describe("formatCaratRange", () => {
  it("shows a range, a single bound, or nothing", () => {
    expect(formatCaratRange({ toString: () => "1.500" }, { toString: () => "3.000" })).toBe("1.5 to 3 ct");
    expect(formatCaratRange({ toString: () => "2.250" }, null)).toBe("From 2.25 ct");
    expect(formatCaratRange(null, { toString: () => "4.000" })).toBe("Up to 4 ct");
    expect(formatCaratRange(null, null)).toBeNull();
  });
});

describe("formatBudgetRange", () => {
  it("formats minor units with the currency", () => {
    const text = formatBudgetRange(BigInt(50000000), BigInt(90000000), "INR");
    expect(text).toContain(" to ");
    expect(text).toContain("5,00,000");
    expect(text).toContain("9,00,000");
  });

  it("handles a single bound and nothing", () => {
    expect(formatBudgetRange(BigInt(50000000), null, "INR")).toMatch(/^From /);
    expect(formatBudgetRange(null, BigInt(90000000), "INR")).toMatch(/^Up to /);
    expect(formatBudgetRange(null, null, "INR")).toBeNull();
  });
});
