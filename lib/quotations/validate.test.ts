import { describe, expect, it } from "vitest";
import {
  endOfValidityDay,
  effectiveQuotationStatus,
  formatMoney,
  isQuotationExpired,
  parseAmountToMinor,
  quotationSides,
  validateQuotation,
  type QuotationDraft,
} from "./validate";

const NOW = new Date("2026-11-09T06:00:00.000Z");

function draft(overrides: Partial<QuotationDraft> = {}): QuotationDraft {
  return {
    itemTitle: "Blue sapphire 5.2 ct",
    quantity: "1",
    amount: "125000",
    currency: "INR",
    validUntil: "2026-12-31",
    terms: "Payment by bank transfer. Delivery insured.",
    ...overrides,
  };
}

describe("parseAmountToMinor", () => {
  it.each([
    ["125000", BigInt(12500000)],
    ["1,25,000.5", BigInt(12500050)],
    ["12.5", BigInt(1250)],
    ["0.01", BigInt(1)],
    [" 7 ", BigInt(700)],
  ])("parses %j", (input, expected) => {
    expect(parseAmountToMinor(input)).toBe(expected);
  });

  it.each(["", "0", "0.00", "-5", "+5", "1.234", "1e3", "abc", "1.2.3"])("rejects %j", (input) => {
    expect(parseAmountToMinor(input)).toBeNull();
  });
});

describe("endOfValidityDay", () => {
  it("is the last instant of the given UTC day", () => {
    expect(endOfValidityDay("2026-11-10")?.toISOString()).toBe("2026-11-10T23:59:59.999Z");
  });

  it("rejects dates that do not exist and malformed text", () => {
    expect(endOfValidityDay("2026-02-30")).toBeNull();
    expect(endOfValidityDay("10/11/2026")).toBeNull();
    expect(endOfValidityDay("")).toBeNull();
  });
});

describe("validateQuotation", () => {
  it("accepts a well-formed quotation and stores amounts in minor units", () => {
    const result = validateQuotation(draft({ quantity: "3", amount: "1,25,000.50", currency: "usd" }), NOW);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.amountMinor).toBe(BigInt(12500050));
    expect(result.value.quantity).toBe(3);
    expect(result.value.currency).toBe("USD");
    expect(result.value.flagged).toBe(false);
  });

  it.each([
    ["quantity 0", draft({ quantity: "0" })],
    ["quantity above 10000", draft({ quantity: "10001" })],
    ["quantity with decimals", draft({ quantity: "1.5" })],
    ["zero amount", draft({ amount: "0" })],
    ["currency not allowed", draft({ currency: "EUR" })],
    ["validity in the past", draft({ validUntil: "2026-11-08" })],
    ["validity more than a year away", draft({ validUntil: "2028-01-01" })],
    ["impossible date", draft({ validUntil: "2026-02-30" })],
    ["empty item name", draft({ itemTitle: "   " })],
    ["terms over 1000 characters", draft({ terms: "a".repeat(1001) })],
  ])("rejects %s", (_label, input) => {
    expect(validateQuotation(input, NOW).ok).toBe(false);
  });

  it("reports contact details found in the terms alone, so the service can refuse the save", () => {
    const result = validateQuotation(draft({ terms: "Call 98765 43210 to pay", itemTitle: "Ruby" }), NOW);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.termsKinds).toContain("PHONE");
      expect(result.value.flagged).toBe(true);
    }
  });

  it("does not report terms when only the item name has contact details", () => {
    const result = validateQuotation(draft({ terms: "Payment by bank transfer.", itemTitle: "Ruby, WhatsApp 9876543210" }), NOW);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.termsKinds).toEqual([]);
  });

  it("masks contact details in the item name and terms, and reports them as flagged", () => {
    const result = validateQuotation(
      draft({ terms: "Call me on 98765 43210 or mail dealer at gmail dot com", itemTitle: "Ruby, WhatsApp 9876543210" }),
      NOW,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.flagged).toBe(true);
    expect(result.value.terms).not.toMatch(/98765|gmail/);
    expect(result.value.itemTitle).not.toMatch(/9876543210/);
    expect(result.value.kinds).toEqual(expect.arrayContaining(["PHONE", "EMAIL"]));
  });
});

describe("expiry", () => {
  it("treats SENT with a past validity date as expired, and leaves other statuses alone", () => {
    const past = new Date("2026-11-08T00:00:00Z");
    const future = new Date("2026-12-08T00:00:00Z");
    expect(isQuotationExpired({ status: "SENT", validUntil: past }, NOW)).toBe(true);
    expect(isQuotationExpired({ status: "SENT", validUntil: future }, NOW)).toBe(false);
    expect(isQuotationExpired({ status: "SENT", validUntil: null }, NOW)).toBe(false);
    expect(isQuotationExpired({ status: "ACCEPTED", validUntil: past }, NOW)).toBe(false);
    expect(effectiveQuotationStatus({ status: "SENT", validUntil: past }, NOW)).toBe("EXPIRED");
    expect(effectiveQuotationStatus({ status: "WITHDRAWN", validUntil: past }, NOW)).toBe("WITHDRAWN");
  });
});

describe("quotationSides", () => {
  const participants = [{ userId: "buyer" }, { userId: "seller" }];

  it("treats the enquirer as buyer side in an enquiry", () => {
    const conv = { kind: "ENQUIRY", startedById: "buyer", participants };
    expect(quotationSides(conv, "seller")).toEqual({ buyerId: "buyer", sellerId: "seller", viewerIsSeller: true });
    expect(quotationSides(conv, "buyer")).toEqual({ buyerId: "buyer", sellerId: "seller", viewerIsSeller: false });
  });

  it("uses the requirement's buyer as buyer side", () => {
    const conv = { kind: "REQUIREMENT", startedById: "seller", requirement: { buyerId: "buyer" }, participants };
    expect(quotationSides(conv, "seller")?.viewerIsSeller).toBe(true);
    expect(quotationSides(conv, "buyer")?.viewerIsSeller).toBe(false);
  });

  it("returns null for general conversations, outsiders and broken requirement links", () => {
    expect(quotationSides({ kind: "GENERAL", startedById: "buyer", participants }, "seller")).toBeNull();
    expect(quotationSides({ kind: "ENQUIRY", startedById: "buyer", participants }, "outsider")).toBeNull();
    expect(quotationSides({ kind: "REQUIREMENT", startedById: "seller", requirement: null, participants }, "seller")).toBeNull();
  });
});

describe("formatMoney", () => {
  it("shows the currency code, Indian grouping for INR, and two decimals", () => {
    expect(formatMoney(BigInt(12500050), "INR")).toBe("INR 1,25,000.50");
    expect(formatMoney(BigInt(5), "USD")).toBe("USD 0.05");
  });
});
