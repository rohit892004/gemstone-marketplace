import { describe, expect, it } from "vitest";
import { categoryThresholdKey, parseThresholdSetting, resolveExpertThreshold } from "./thresholds";

describe("parseThresholdSetting", () => {
  it("reads a decimal string of minor units", () => {
    expect(parseThresholdSetting("5000000")).toBe(BigInt(5000000));
  });
  it("treats anything else as no threshold", () => {
    expect(parseThresholdSetting(null)).toBeNull();
    expect(parseThresholdSetting(5000000)).toBeNull();
    expect(parseThresholdSetting("-1")).toBeNull();
    expect(parseThresholdSetting("12.5")).toBeNull();
    expect(parseThresholdSetting("")).toBeNull();
    expect(parseThresholdSetting("9999999999999999")).toBeNull();
  });
});

describe("resolveExpertThreshold", () => {
  it("uses the category override when set", () => {
    expect(resolveExpertThreshold(BigInt(100), BigInt(50))).toBe(BigInt(50));
  });
  it("falls back to the global value", () => {
    expect(resolveExpertThreshold(BigInt(100), null)).toBe(BigInt(100));
  });
  it("is null when neither is set", () => {
    expect(resolveExpertThreshold(null, null)).toBeNull();
  });
  it("a category override can be higher than the global value", () => {
    expect(resolveExpertThreshold(BigInt(100), BigInt(500))).toBe(BigInt(500));
  });
});

describe("categoryThresholdKey", () => {
  it("namespaces the override under the global key", () => {
    expect(categoryThresholdKey("cat_1")).toBe("valuation.expertThreshold.cat_1");
  });
});
