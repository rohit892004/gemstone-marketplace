import { describe, expect, it } from "vitest";
import { VALUATION_DISCLAIMER, buildValuationPdf, qrModules, toPdfAscii, type ValuationPdfInput } from "./pdf";

const base: ValuationPdfInput = {
  reference: "GSV-26-K7Q2M9",
  verifyUrl: "https://gemstone.test/valuation/verify/GSV-26-K7Q2M9",
  issuedLabel: "10 November 2026",
  statusLabel: "Valid",
  valuedByLabel: "Automatic (rule-based, indicative)",
  rows: [
    { label: "Gemstone type", value: "Sapphire" },
    { label: "Carat", value: "2.500 ct" },
  ],
  estimateLabel: "INR 1,25,000.00",
  rangeLabel: "INR 1,00,000.00 to INR 1,50,000.00",
  confidenceLabel: "MEDIUM",
  factors: ["Reference price for Sapphire, Fine grade: INR 50,000.00 per carat."],
  isDemo: true,
  withdrawn: false,
};

function countPages(pdf: Buffer): number {
  const match = pdf.toString("latin1").match(/\/Count (\d+)/);
  return match ? Number(match[1]) : 0;
}

describe("qrModules", () => {
  it("returns a square module matrix with dark and light modules", () => {
    const qr = qrModules(base.verifyUrl);
    expect(qr.size).toBeGreaterThan(20);
    let dark = 0;
    for (let r = 0; r < qr.size; r += 1) for (let c = 0; c < qr.size; c += 1) if (qr.isDark(r, c)) dark += 1;
    expect(dark).toBeGreaterThan(qr.size);
    expect(dark).toBeLessThan(qr.size * qr.size);
  });
});

describe("buildValuationPdf", () => {
  it("is a PDF with the reference, the verification address and the QR code", () => {
    const pdf = buildValuationPdf(base);
    const text = pdf.toString("latin1");
    expect(text.startsWith("%PDF-1.4")).toBe(true);
    expect(text.endsWith("%%EOF\n")).toBe(true);
    expect(text).toContain("Reference GSV-26-K7Q2M9");
    expect(text).toContain(base.verifyUrl);
    // One filled rectangle per dark QR module.
    const dark = qrModules(base.verifyUrl);
    let darkCount = 0;
    for (let r = 0; r < dark.size; r += 1) for (let c = 0; c < dark.size; c += 1) if (dark.isDark(r, c)) darkCount += 1;
    expect(text.split(" re f").length - 1).toBeGreaterThanOrEqual(darkCount);
  });

  it("carries the disclaimer and the reference on every page", () => {
    const rows = Array.from({ length: 40 }, (_, i) => ({ label: `Field ${i}`, value: "A value that takes a line" }));
    const pdf = buildValuationPdf({
      ...base,
      rows,
      factors: Array.from({ length: 30 }, (_, i) => `Factor number ${i} with enough words to wrap onto another line of text.`),
    });
    const pages = countPages(pdf);
    expect(pages).toBeGreaterThan(1);
    const text = pdf.toString("latin1");
    const disclaimerStart = VALUATION_DISCLAIMER.slice(0, 40);
    expect(text.split(disclaimerStart).length - 1).toBeGreaterThanOrEqual(pages);
    expect(text.split("Reference GSV-26-K7Q2M9   Page").length - 1).toBe(pages);
  });

  it("never includes a requester field, and says so when there is no result", () => {
    const pdf = buildValuationPdf({
      ...base,
      statusLabel: "Not complete",
      valuedByLabel: null,
      estimateLabel: null,
      rangeLabel: null,
      confidenceLabel: null,
      withdrawn: true,
    });
    const text = pdf.toString("latin1");
    expect(text).toContain("WITHDRAWN");
    expect(text).toContain("No result yet");
    expect(text).not.toContain("Valued by:");
    expect(text).not.toMatch(/Requester|Email|Mobile/i);
  });

  it("shows the demo label when the reference data is demo data", () => {
    expect(buildValuationPdf(base).toString("latin1")).toContain("Demo - indicative");
    expect(buildValuationPdf({ ...base, isDemo: false }).toString("latin1")).not.toContain("Demo - indicative");
  });

  it("maps typographic characters to ASCII", () => {
    expect(toPdfAscii("Demo — indicative – ‘x’")).toBe("Demo - indicative - 'x'");
  });
});
