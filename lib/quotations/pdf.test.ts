import { describe, expect, it } from "vitest";
import { buildQuotationPdf, escapePdfText, wrapText, type QuotationPdfInput } from "./pdf";

const input: QuotationPdfInput = {
  quotationId: "q_123",
  businessName: "Ceylon Gems (Demo) & Co",
  itemTitle: "Ruby \\ pair (2 pcs)",
  quantity: 2,
  amountLabel: "INR 1,25,000.50",
  validUntilLabel: "31 Dec 2026",
  statusLabel: "Awaiting response",
  terms: "Payment by bank transfer.\nDelivery insured to the buyer's address.",
  issuedLabel: "09 Nov 2026",
  isDemo: true,
};

describe("escapePdfText", () => {
  it("escapes parentheses and backslashes for PDF literal strings", () => {
    expect(escapePdfText("a (b) \\ c")).toBe("a \\(b\\) \\\\ c");
  });

  it("replaces non-ASCII and control characters with ?", () => {
    expect(escapePdfText("₹ 5\tok\n")).toBe("? 5?ok?");
  });
});

describe("wrapText", () => {
  it("keeps every line within the limit and does not lose words", () => {
    const text = "one two three four five six seven eight nine ten eleven twelve".repeat(3);
    const lines = wrapText(text, 20);
    expect(lines.every((l) => l.length <= 20)).toBe(true);
    expect(lines.join(" ").split(/\s+/).filter(Boolean)).toEqual(text.split(/\s+/));
  });

  it("hard-splits words longer than the limit", () => {
    expect(wrapText("x".repeat(25), 10)).toEqual(["x".repeat(10), "x".repeat(10), "x".repeat(5)]);
  });
});

describe("buildQuotationPdf", () => {
  const pdf = buildQuotationPdf(input);
  const text = pdf.toString("latin1");

  it("starts with the PDF header and ends with the EOF marker", () => {
    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(text.trimEnd().endsWith("%%EOF")).toBe(true);
  });

  it("writes escaped user text into the content stream", () => {
    expect(text).toContain("(Ruby \\\\ pair \\(2 pcs\\)) Tj");
    expect(text).toContain("(Business: Ceylon Gems \\(Demo\\) & Co) Tj");
  });

  it("labels demo quotations", () => {
    expect(text).toContain("Demo quotation");
    const live = buildQuotationPdf({ ...input, isDemo: false }).toString("latin1");
    expect(live).not.toContain("Demo quotation");
  });

  it("has a cross-reference table whose offsets point at the objects", () => {
    const startxref = Number(/startxref\n(\d+)\n%%EOF/.exec(text)?.[1]);
    expect(text.slice(startxref, startxref + 4)).toBe("xref");
    const entries = text.slice(startxref).split("\n").filter((l) => / n $/.test(l));
    expect(entries.length).toBe(6);
    entries.forEach((entry, index) => {
      const offset = Number(entry.slice(0, 10));
      const label = `${index + 1} 0 obj`;
      expect(text.slice(offset, offset + label.length)).toBe(label);
    });
  });

  it("does not contain an email address or phone number when none were given", () => {
    expect(text).not.toMatch(/@/);
  });
});
