import { describe, expect, it } from "vitest";
import { formatMoney } from "@/lib/money/money";
import { runValuationEngine, type MultiplierTable, type ReferenceRow, type ValuationInput } from "./engine";

const ref: ReferenceRow[] = [
  { gemstoneType: "Sapphire", qualityGrade: "FINE", band: "UNDER_1", pricePerCaratMinor: BigInt(5000000), currency: "INR" },
];
const multipliers: MultiplierTable = { origin: {}, treatment: {}, lab: { none: 10000 } };

const input: ValuationInput = {
  gemstoneType: "Sapphire",
  qualityGrade: "FINE",
  caratMilli: 500,
  currency: "INR",
  origin: "constructor",
  treatment: "__proto__",
  labCode: null,
  certificateNumber: null,
  dimensionsGiven: true,
  colourGiven: true,
  clarityGiven: false,
};

describe("engine prototype keys", () => {
  it("does not treat inherited names as known origins or treatments", () => {
    const out = runValuationEngine(input, ref, multipliers);
    expect(out.completenessScore).toBe(3); // quality, dimensions, colour only
    expect(out.confidence).toBe("LOW");
    expect(out.expertReasons).toContain("LOW_CONFIDENCE");
    expect(out.factors.join(" ")).not.toContain("Origin constructor: x");
  });
});

describe("engine zero estimate", () => {
  it("sends a value that rounds to nothing to an expert, not an auto result", () => {
    const tiny = [{ ...ref[0], pricePerCaratMinor: BigInt(1) }];
    const out = runValuationEngine({ ...input, origin: null, treatment: null, caratMilli: 10 }, tiny, multipliers);
    expect(out.estimate).toBeNull();
    expect(out.expertReasons).toContain("LOW_CONFIDENCE");
  });
});

describe("formatMoney", () => {
  it("keeps exact digits above 2^53 minor units", () => {
    const text = formatMoney(BigInt("900719925474099312"), "USD");
    expect(text).toBe("$9,007,199,254,740,993.12");
  });
  it("shows two decimals only when there are cents", () => {
    expect(formatMoney(BigInt(125000), "INR")).toBe("₹1,250");
    expect(formatMoney(BigInt(125005), "INR")).toBe("₹1,250.05");
  });
});
