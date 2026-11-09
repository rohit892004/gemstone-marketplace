import { describe, expect, it } from "vitest";
import { formatMoney, parseMajorToMinor } from "./money";

describe("parseMajorToMinor", () => {
  it("converts major units to minor units exactly", () => {
    expect(parseMajorToMinor("12,500.50")).toEqual({ ok: true, minor: BigInt(1250050) });
    expect(parseMajorToMinor("7")).toEqual({ ok: true, minor: BigInt(700) });
    expect(parseMajorToMinor("0.5")).toEqual({ ok: true, minor: BigInt(50) });
  });

  it("rejects malformed, negative, zero and out-of-range values", () => {
    expect(parseMajorToMinor("12.345").ok).toBe(false);
    expect(parseMajorToMinor("-5").ok).toBe(false);
    expect(parseMajorToMinor("1e3").ok).toBe(false);
    expect(parseMajorToMinor("0").ok).toBe(false);
    expect(parseMajorToMinor("99999999999").ok).toBe(false);
  });
});

describe("formatMoney", () => {
  it("formats INR and USD from minor units", () => {
    expect(formatMoney(BigInt(1250050), "INR")).toContain("12,500.50");
    expect(formatMoney(BigInt(100), "USD")).toContain("1");
  });

  it("returns null for missing amounts", () => {
    expect(formatMoney(null, "INR")).toBeNull();
  });
});
