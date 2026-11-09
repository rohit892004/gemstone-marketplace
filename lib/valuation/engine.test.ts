import { describe, expect, it } from "vitest";
import { buildDemoReferenceRows, DEMO_MULTIPLIERS, VALUATION_CATEGORIES } from "./defaults";
import {
  applyExpertThreshold,
  caratBandFor,
  caratToMilli,
  CONFIDENCE_SPREAD_BPS,
  confidenceFor,
  type EngineOutput,
  type MultiplierTable,
  type ReferenceRow,
  needsExpert,
  ratio,
  runValuationEngine,
  type ValuationInput,
} from "./engine";

/** A small, hand-checkable reference table. */
const REF: ReferenceRow[] = [
  { gemstoneType: "Sapphire", qualityGrade: "FINE", band: "UNDER_1", pricePerCaratMinor: BigInt(4500000), currency: "INR" },
  { gemstoneType: "Sapphire", qualityGrade: "FINE", band: "1_TO_2", pricePerCaratMinor: BigInt(5000000), currency: "INR" },
  { gemstoneType: "Sapphire", qualityGrade: "FINE", band: "2_TO_5", pricePerCaratMinor: BigInt(6000000), currency: "INR" },
  { gemstoneType: "Sapphire", qualityGrade: "FINE", band: "5_PLUS", pricePerCaratMinor: BigInt(8000000), currency: "INR" },
  { gemstoneType: "Sapphire", qualityGrade: "FINE", band: "1_TO_2", pricePerCaratMinor: BigInt(60000), currency: "USD" },
];

/** Multipliers with easy numbers: origin Ceylon x1.15, treatment heat x0.85, GIA x1.05, none x0.9. */
const MULT: MultiplierTable = {
  origin: { ceylon: 11500, madagascar: 10500 },
  treatment: { none: 10000, heat: 8500, unknown: 9000 },
  lab: { none: 9000, gia: 10500, other: 10000 },
};

/** A complete input that should come out HIGH before any changes. */
function full(overrides: Partial<ValuationInput> = {}): ValuationInput {
  return {
    gemstoneType: "Sapphire",
    qualityGrade: "FINE",
    caratMilli: 1500,
    currency: "INR",
    origin: "Ceylon",
    treatment: "None",
    labCode: "gia",
    certificateNumber: "GIA-123",
    dimensionsGiven: true,
    colourGiven: true,
    clarityGiven: true,
    ...overrides,
  };
}

describe("caratToMilli", () => {
  it("accepts weights with up to three decimals and returns milli-carats", () => {
    expect(caratToMilli("2.5")).toBe(2500);
    expect(caratToMilli(0.01)).toBe(10);
    expect(caratToMilli("1.234")).toBe(1234);
    expect(caratToMilli(" 3 ")).toBe(3000);
  });

  it("rejects values outside 0.01 to 10,000 ct", () => {
    expect(caratToMilli("0")).toBeNull();
    expect(caratToMilli("0.009")).toBeNull();
    expect(caratToMilli("-1")).toBeNull();
    expect(caratToMilli("10000.001")).toBeNull();
    expect(caratToMilli("10001")).toBeNull();
  });

  it("rejects more than three decimal places and non-numbers", () => {
    expect(caratToMilli("1.2345")).toBeNull();
    expect(caratToMilli("abc")).toBeNull();
    expect(caratToMilli("")).toBeNull();
    expect(caratToMilli(Number.NaN)).toBeNull();
    expect(caratToMilli(Number.POSITIVE_INFINITY)).toBeNull();
  });

  it("accepts the maximum weight", () => {
    expect(caratToMilli("10000")).toBe(10_000_000);
  });
});

describe("caratBandFor", () => {
  it("places weights in the right band, with edges going up", () => {
    expect(caratBandFor(999)).toBe("UNDER_1");
    expect(caratBandFor(1000)).toBe("1_TO_2");
    expect(caratBandFor(1999)).toBe("1_TO_2");
    expect(caratBandFor(2000)).toBe("2_TO_5");
    expect(caratBandFor(4999)).toBe("2_TO_5");
    expect(caratBandFor(5000)).toBe("5_PLUS");
    expect(caratBandFor(10_000_000)).toBe("5_PLUS");
  });

  it("returns null outside the valid range or for non-integers", () => {
    expect(caratBandFor(9)).toBeNull();
    expect(caratBandFor(10_000_001)).toBeNull();
    expect(caratBandFor(1.5)).toBeNull();
  });
});

describe("confidenceFor", () => {
  it("is HIGH only with 7 or more points and a lab certificate", () => {
    expect(confidenceFor(7, true)).toBe("HIGH");
    expect(confidenceFor(9, true)).toBe("HIGH");
    expect(confidenceFor(9, false)).toBe("MEDIUM");
  });

  it("is MEDIUM from 4 points, LOW below", () => {
    expect(confidenceFor(4, false)).toBe("MEDIUM");
    expect(confidenceFor(6, true)).toBe("MEDIUM");
    expect(confidenceFor(3, true)).toBe("LOW");
    expect(confidenceFor(0, false)).toBe("LOW");
  });
});

describe("runValuationEngine: estimate arithmetic", () => {
  it("computes price x carat x multipliers exactly, with a HIGH range of plus or minus 10%", () => {
    // 1.5 ct in the 1-2 ct band: 5,000,000 paise/ct x 1.5 = 7,500,000.
    // x Ceylon 1.15 x heat-free 1.0 x GIA 1.05 = 7,500,000 x 1.2075 = 9,056,250.
    const out = runValuationEngine(full(), REF, MULT);
    expect(out.confidence).toBe("HIGH");
    expect(out.estimate).not.toBeNull();
    expect(out.estimate?.estimateMinor).toBe(BigInt(9056250));
    expect(out.estimate?.lowMinor).toBe(BigInt(8150625)); // minus 10%
    expect(out.estimate?.highMinor).toBe(BigInt(9961875)); // plus 10%
    expect(out.estimate?.currency).toBe("INR");
    expect(needsExpert(out)).toBe(false);
  });

  it("applies the treatment multiplier", () => {
    // 7,500,000 x 1.15 x heat 0.85 x GIA 1.05 = 7,500,000 x 1.026375 = 7,697,812.5 -> 7,697,813 (half up).
    const out = runValuationEngine(full({ treatment: "heat" }), REF, MULT);
    expect(out.estimate?.estimateMinor).toBe(BigInt(7697813));
  });

  it("uses the no-certificate lab multiplier when there is no lab", () => {
    // 7,500,000 x 1.15 x 1.0 x none 0.9 = 7,762,500.
    const out = runValuationEngine(full({ labCode: null, certificateNumber: null }), REF, MULT);
    expect(out.estimate?.estimateMinor).toBe(BigInt(7762500));
    expect(out.confidence).toBe("MEDIUM");
  });

  it("uses x1 for an origin that is not in the table and says so", () => {
    const out = runValuationEngine(full({ origin: "Atlantis" }), REF, MULT);
    expect(out.factors.join(" ")).toContain('Origin "Atlantis" is not in the table');
    // 7,500,000 x 1.0 x 1.0 x 1.05 = 7,875,000.
    expect(out.estimate?.estimateMinor).toBe(BigInt(7875000));
  });

  it("treats the UNKNOWN treatment as not confirmed (x1, no confidence points)", () => {
    const withUnknown = runValuationEngine(full({ treatment: "Unknown" }), REF, MULT);
    const withNone = runValuationEngine(full({ treatment: "None" }), REF, MULT);
    expect(withUnknown.completenessScore).toBe(withNone.completenessScore - 1);
    expect(withUnknown.factors.join(" ")).toContain("Treatment not confirmed");
  });

  it("matches grades and bands exactly, and never estimates in another currency", () => {
    // 2.5 ct is in the 2-5 ct band, which has no USD row in the test table.
    const out = runValuationEngine(full({ currency: "USD", caratMilli: 2500 }), REF, MULT);
    expect(out.estimate).toBeNull();
    expect(out.expertReasons).toContain("NO_REFERENCE");
  });

  it("uses the USD row when one exists", () => {
    const out = runValuationEngine(full({ currency: "USD", caratMilli: 1000 }), REF, MULT);
    // 60,000 cents/ct x 1.0 ct x 1.15 x 1.05 = 72,450 cents.
    expect(out.estimate?.estimateMinor).toBe(BigInt(72450));
    expect(out.estimate?.currency).toBe("USD");
  });

  it("rounds half up to the minor unit", () => {
    // 1 ct at 1,000 paise/ct, Ceylon x1.15, GIA x1.05 = 1,207.5 -> 1,208.
    // 1 ct is in the 1-2 ct band.
    const rows: ReferenceRow[] = [
      { gemstoneType: "Ruby", qualityGrade: "STANDARD", band: "1_TO_2", pricePerCaratMinor: BigInt(1000), currency: "INR" },
    ];
    const out = runValuationEngine(
      full({ gemstoneType: "Ruby", qualityGrade: "STANDARD", caratMilli: 1000 }),
      rows,
      MULT,
    );
    expect(out.estimate?.estimateMinor).toBe(BigInt(1208));
  });

  it("keeps low <= estimate <= high for every confidence level", () => {
    for (const input of [full(), full({ labCode: null, certificateNumber: null }), full({ origin: null, treatment: null, labCode: null, certificateNumber: null, dimensionsGiven: false, colourGiven: false, clarityGiven: false })]) {
      const out = runValuationEngine(input, REF, MULT);
      if (out.estimate === null) continue;
      expect(out.estimate.lowMinor <= out.estimate.estimateMinor).toBe(true);
      expect(out.estimate.estimateMinor <= out.estimate.highMinor).toBe(true);
    }
  });

  it("uses the spread for the confidence level it reports", () => {
    expect(CONFIDENCE_SPREAD_BPS).toEqual({ HIGH: 1000, MEDIUM: 2000, LOW: 3500 });
    const medium = runValuationEngine(full({ labCode: null, certificateNumber: null }), REF, MULT);
    const est = medium.estimate!.estimateMinor;
    expect(medium.estimate!.lowMinor).toBe((est * BigInt(8000) + BigInt(5000)) / BigInt(10000));
    expect(medium.estimate!.highMinor).toBe((est * BigInt(12000) + BigInt(5000)) / BigInt(10000));
  });
});

describe("runValuationEngine: routing to an expert", () => {
  it("routes an incomplete request (no carat) without an estimate", () => {
    const out = runValuationEngine(full({ caratMilli: null }), REF, MULT);
    expect(out.estimate).toBeNull();
    expect(out.expertReasons).toEqual(expect.arrayContaining(["INCOMPLETE", "LOW_CONFIDENCE"]));
    expect(needsExpert(out)).toBe(true);
  });

  it("routes a request with no quality grade", () => {
    const out = runValuationEngine(full({ qualityGrade: null }), REF, MULT);
    expect(out.estimate).toBeNull();
    expect(out.expertReasons).toContain("INCOMPLETE");
  });

  it("routes a gemstone type with no reference data", () => {
    const out = runValuationEngine(full({ gemstoneType: "Jadeite" }), REF, MULT);
    expect(out.estimate).toBeNull();
    expect(out.expertReasons).toEqual(expect.arrayContaining(["NO_REFERENCE", "LOW_CONFIDENCE"]));
    expect(out.factors.join(" ")).toContain("No reference price for Jadeite");
  });

  it("routes LOW confidence even when there is an estimate", () => {
    const out = runValuationEngine(
      full({ labCode: null, certificateNumber: null, origin: null, treatment: null, dimensionsGiven: false, colourGiven: false, clarityGiven: false }),
      REF,
      MULT,
    );
    expect(out.confidence).toBe("LOW");
    expect(out.estimate).not.toBeNull();
    expect(out.expertReasons).toContain("LOW_CONFIDENCE");
  });

  it("applies the admin threshold: above it routes to an expert, at or below it does not", () => {
    const out = runValuationEngine(full(), REF, MULT);
    const est = out.estimate!.estimateMinor;
    expect(needsExpert(applyExpertThreshold(out, est))).toBe(false);
    expect(applyExpertThreshold(out, est - BigInt(1)).expertReasons).toContain("ABOVE_THRESHOLD");
  });

  it("does nothing with the threshold when there is no estimate or no threshold", () => {
    const none = runValuationEngine(full({ caratMilli: null }), REF, MULT);
    expect(applyExpertThreshold(none, BigInt(1))).toBe(none);
    const out = runValuationEngine(full(), REF, MULT);
    expect(applyExpertThreshold(out, null)).toBe(out);
  });
});

describe("runValuationEngine: extreme and odd inputs", () => {
  it("handles the largest allowed weight without overflow", () => {
    const rows: ReferenceRow[] = [
      { gemstoneType: "Diamond", qualityGrade: "PREMIUM", band: "5_PLUS", pricePerCaratMinor: BigInt(999999999999), currency: "INR" },
    ];
    const out = runValuationEngine(
      full({ gemstoneType: "Diamond", qualityGrade: "PREMIUM", caratMilli: 10_000_000, origin: null, treatment: null, labCode: null, certificateNumber: null }),
      rows,
      MULT,
    );
    // 999,999,999,999 x 10,000 ct x none 0.9 = 8,999,999,999,910,000 (exact).
    expect(out.estimate?.estimateMinor).toBe(BigInt(8999999999991000));
  });

  it("gives the smallest weight a small but positive estimate", () => {
    const out = runValuationEngine(full({ caratMilli: 10 }), REF, MULT);
    expect(out.estimate!.estimateMinor > BigInt(0)).toBe(true);
  });

  it("lists the reference used and the factors in plain language", () => {
    const out = runValuationEngine(full(), REF, MULT);
    expect(out.factors[0]).toContain("Reference price for Sapphire, Fine grade, 1 to 2 ct");
    expect(out.factors.join(" ")).not.toMatch(/image|photo/i);
  });

  it("does not depend on the case or spacing of the gemstone type", () => {
    const a = runValuationEngine(full({ gemstoneType: "  SAPPHIRE " }), REF, MULT);
    const b = runValuationEngine(full(), REF, MULT);
    expect(a.estimate?.estimateMinor).toBe(b.estimate?.estimateMinor);
  });

  it("is deterministic", () => {
    const first: EngineOutput = runValuationEngine(full(), REF, MULT);
    const second: EngineOutput = runValuationEngine(full(), REF, MULT);
    expect(second).toEqual(first);
  });

  it("formats a multiplier as a plain decimal", () => {
    expect(ratio(BigInt(10000))).toBe("1");
    expect(ratio(BigInt(8500))).toBe("0.85");
    expect(ratio(BigInt(11500))).toBe("1.15");
  });
});

describe("demo reference data", () => {
  const rows = buildDemoReferenceRows();

  it("covers every category, grade and carat band in INR and USD", () => {
    expect(VALUATION_CATEGORIES).toHaveLength(7);
    // 7 categories x 4 grades x 4 bands x 2 currencies.
    expect(rows).toHaveLength(7 * 4 * 4 * 2);
  });

  it("uses positive whole minor units and rises with grade and carat", () => {
    for (const row of rows) expect(row.pricePerCaratMinor > BigInt(0)).toBe(true);
    const price = (grade: string, band: string) =>
      rows.find((r) => r.gemstoneType === "Ruby" && r.qualityGrade === grade && r.band === band && r.currency === "INR")!
        .pricePerCaratMinor;
    expect(price("PREMIUM", "UNDER_1") > price("FINE", "UNDER_1")).toBe(true);
    expect(price("FINE", "5_PLUS") > price("FINE", "UNDER_1")).toBe(true);
  });

  it("has multipliers for every origin, treatment and lab key the form offers", () => {
    expect(DEMO_MULTIPLIERS.lab.none).toBeDefined();
    expect(Object.values(DEMO_MULTIPLIERS.origin).every((v) => v > 0)).toBe(true);
  });

  it("produces an estimate for a demo stone that has every field", () => {
    const out = runValuationEngine(full({ gemstoneType: "Ruby", qualityGrade: "FINE", caratMilli: 2500 }), rows, DEMO_MULTIPLIERS);
    expect(out.estimate).not.toBeNull();
  });
});
