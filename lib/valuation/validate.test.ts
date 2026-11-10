import { describe, expect, it } from "vitest";
import { CONTACT_REFUSAL, parseSignOff, parseThreadText, parseValuationDetails } from "./validate";

const base = {
  gemstoneType: "Sapphire",
  categoryId: "",
  shape: "Oval",
  carat: "2.5",
  dimensions: "",
  colour: "Blue",
  clarity: "Eye clean",
  qualityGrade: "FINE",
  origin: "Sri Lanka",
  treatment: "",
  labId: "",
  certificateNumber: "",
  notes: "",
  currency: "INR",
};

describe("parseValuationDetails", () => {
  it("accepts a complete form and converts carat to milli-carats", () => {
    const result = parseValuationDetails(base);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.caratMilli).toBe(2500);
      expect(result.value.categoryId).toBeNull();
      expect(result.value.treatment).toBeNull();
      expect(result.value.qualityGrade).toBe("FINE");
    }
  });

  it("requires a gemstone type and a carat weight", () => {
    expect(parseValuationDetails({ ...base, gemstoneType: "" }).ok).toBe(false);
    expect(parseValuationDetails({ ...base, carat: "" }).ok).toBe(false);
  });

  it("rejects carat weights outside 0.01 to 10,000 ct and more than three decimals", () => {
    expect(parseValuationDetails({ ...base, carat: "0.001" }).ok).toBe(false);
    expect(parseValuationDetails({ ...base, carat: "10001" }).ok).toBe(false);
    expect(parseValuationDetails({ ...base, carat: "1.2345" }).ok).toBe(false);
    expect(parseValuationDetails({ ...base, carat: "abc" }).ok).toBe(false);
    expect(parseValuationDetails({ ...base, carat: "0.01" }).ok).toBe(true);
  });

  it("refuses notes that carry contact details, with the fixed message", () => {
    const result = parseValuationDetails({ ...base, notes: "Call me on 98765 43210" });
    expect(result).toEqual({ ok: false, error: CONTACT_REFUSAL });
  });

  it("accepts notes without contact details, and returns them as typed", () => {
    const result = parseValuationDetails({ ...base, notes: "Certificate GIA-l2345 is in the box." });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.notes).toBe("Certificate GIA-l2345 is in the box.");
  });

  it("rejects an unknown quality grade and an unknown currency", () => {
    expect(parseValuationDetails({ ...base, qualityGrade: "FLAWLESS" }).ok).toBe(false);
    expect(parseValuationDetails({ ...base, currency: "EUR" }).ok).toBe(false);
  });

  it("rejects overlong text", () => {
    expect(parseValuationDetails({ ...base, shape: "x".repeat(61) }).ok).toBe(false);
  });
});

describe("parseThreadText", () => {
  it("trims and accepts plain text", () => {
    expect(parseThreadText("  Please send a close-up of the girdle.  ", "a question")).toEqual({
      ok: true,
      value: "Please send a close-up of the girdle.",
    });
  });
  it("refuses blank text and contact details", () => {
    expect(parseThreadText("   ", "a question").ok).toBe(false);
    expect(parseThreadText("write to test@example.com", "a question")).toEqual({ ok: false, error: CONTACT_REFUSAL });
  });
});

describe("parseSignOff", () => {
  const good = { estimate: "12500.50", low: "11000", high: "14000", confidence: "MEDIUM", notes: "Compared with two recent sales." };

  it("converts major units to minor units", () => {
    const result = parseSignOff(good);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.estimateMinor).toBe(BigInt(1250050));
      expect(result.value.lowMinor).toBe(BigInt(1100000));
      expect(result.value.highMinor).toBe(BigInt(1400000));
    }
  });

  it("requires low <= estimate <= high", () => {
    expect(parseSignOff({ ...good, estimate: "15000" }).ok).toBe(false);
    expect(parseSignOff({ ...good, low: "13000" }).ok).toBe(false);
  });

  it("refuses zero, negative, over-precise and non-numeric amounts", () => {
    expect(parseSignOff({ ...good, low: "0" }).ok).toBe(false);
    expect(parseSignOff({ ...good, estimate: "-5" }).ok).toBe(false);
    expect(parseSignOff({ ...good, estimate: "1.005" }).ok).toBe(false);
    expect(parseSignOff({ ...good, high: "lots" }).ok).toBe(false);
  });

  it("requires a known confidence level and a note", () => {
    expect(parseSignOff({ ...good, confidence: "CERTAIN" }).ok).toBe(false);
    expect(parseSignOff({ ...good, notes: "" }).ok).toBe(false);
  });
});
