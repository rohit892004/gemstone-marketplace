import { describe, expect, it } from "vitest";
import { MASK } from "@/lib/messaging/moderation";
import { parseCarat, parseDeadline, type RequirementRaw, validateRequirementInput } from "./validate";

const NOW = new Date("2026-11-09T10:00:00.000Z");

const valid: RequirementRaw = {
  gemstoneType: "Sapphire",
  categoryId: "",
  shape: "",
  caratMin: "",
  caratMax: "",
  budgetMin: "",
  budgetMax: "",
  currency: "INR",
  certificateNeeded: null,
  originPreference: "",
  quantity: "1",
  deadline: "",
  notes: "",
};

function withRaw(patch: Partial<RequirementRaw>): RequirementRaw {
  return { ...valid, ...patch };
}

describe("validateRequirementInput basics", () => {
  it("accepts a minimal requirement and fills defaults", () => {
    const result = validateRequirementInput(valid, NOW);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.values).toMatchObject({
      gemstoneType: "Sapphire",
      categoryId: null,
      budgetMinMinor: null,
      budgetMaxMinor: null,
      currency: "INR",
      certificateNeeded: false,
      quantity: 1,
      deadline: null,
      notes: null,
    });
    expect(result.flagged).toBe(false);
  });

  it("requires a gemstone type of 2 to 60 characters", () => {
    expect(validateRequirementInput(withRaw({ gemstoneType: "S" }), NOW)).toMatchObject({ ok: false });
    expect(validateRequirementInput(withRaw({ gemstoneType: "a".repeat(61) }), NOW)).toMatchObject({ ok: false });
    expect(validateRequirementInput(withRaw({ gemstoneType: "  Ruby  " }), NOW)).toMatchObject({ ok: true });
  });

  it("only allows INR or USD", () => {
    const result = validateRequirementInput(withRaw({ currency: "EUR" }), NOW);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fieldErrors.currency).toBeDefined();
  });

  it("reads certificate-needed from checkbox values", () => {
    for (const value of ["on", "true", "1", true]) {
      const result = validateRequirementInput(withRaw({ certificateNeeded: value }), NOW);
      expect(result.ok && result.values.certificateNeeded).toBe(true);
    }
    const off = validateRequirementInput(withRaw({ certificateNeeded: null }), NOW);
    expect(off.ok && off.values.certificateNeeded).toBe(false);
  });
});

describe("quantity", () => {
  it("accepts 1 to 10000 and refuses anything else", () => {
    expect(validateRequirementInput(withRaw({ quantity: "1" }), NOW).ok).toBe(true);
    expect(validateRequirementInput(withRaw({ quantity: "10000" }), NOW).ok).toBe(true);
    expect(validateRequirementInput(withRaw({ quantity: "0" }), NOW).ok).toBe(false);
    expect(validateRequirementInput(withRaw({ quantity: "10001" }), NOW).ok).toBe(false);
    expect(validateRequirementInput(withRaw({ quantity: "2.5" }), NOW).ok).toBe(false);
    expect(validateRequirementInput(withRaw({ quantity: "" }), NOW).ok).toBe(false);
  });
});

describe("carat range", () => {
  it("parses carat values to three decimals", () => {
    expect(parseCarat("1.5")).toBe("1.500");
    expect(parseCarat("0.01")).toBe("0.010");
    expect(parseCarat("100000")).toBe("100000.000");
  });

  it("refuses bad carat formats and out-of-range values", () => {
    expect(parseCarat("0")).toBeNull();
    expect(parseCarat("0.009")).toBeNull();
    expect(parseCarat("100000.001")).toBeNull();
    expect(parseCarat("1.2345")).toBeNull();
    expect(parseCarat("abc")).toBeNull();
    expect(parseCarat("-2")).toBeNull();
  });

  it("refuses a minimum above the maximum", () => {
    const result = validateRequirementInput(withRaw({ caratMin: "5", caratMax: "3" }), NOW);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fieldErrors.caratMax).toBeDefined();
  });

  it("accepts an equal minimum and maximum, or a single bound", () => {
    expect(validateRequirementInput(withRaw({ caratMin: "2", caratMax: "2" }), NOW).ok).toBe(true);
    expect(validateRequirementInput(withRaw({ caratMin: "2" }), NOW).ok).toBe(true);
  });
});

describe("budget range", () => {
  it("stores budgets in minor units", () => {
    const result = validateRequirementInput(withRaw({ budgetMin: "5,00,000", budgetMax: "9,00,000.50" }), NOW);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.values.budgetMinMinor).toBe(BigInt(50000000));
      expect(result.values.budgetMaxMinor).toBe(BigInt(90000050));
    }
  });

  it("refuses a minimum above the maximum", () => {
    const result = validateRequirementInput(withRaw({ budgetMin: "900", budgetMax: "500" }), NOW);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fieldErrors.budgetMax).toBeDefined();
  });

  it("refuses a budget that is not a number", () => {
    const result = validateRequirementInput(withRaw({ budgetMin: "lots" }), NOW);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fieldErrors.budgetMin).toBeDefined();
  });

  it("refuses zero and more than two decimals", () => {
    expect(validateRequirementInput(withRaw({ budgetMax: "0" }), NOW).ok).toBe(false);
    expect(validateRequirementInput(withRaw({ budgetMax: "10.555" }), NOW).ok).toBe(false);
  });
});

describe("deadline", () => {
  it("parses a real calendar date as the end of that UTC day", () => {
    const d = parseDeadline("2026-12-31");
    expect(d?.toISOString()).toBe("2026-12-31T23:59:59.999Z");
  });

  it("refuses dates that do not exist or are malformed", () => {
    expect(parseDeadline("2026-02-30")).toBeNull();
    expect(parseDeadline("31/12/2026")).toBeNull();
    expect(parseDeadline("2026-13-01")).toBeNull();
  });

  it("refuses a deadline in the past or today after the day has ended", () => {
    expect(validateRequirementInput(withRaw({ deadline: "2026-11-01" }), NOW).ok).toBe(false);
    // NOW is 10:00 UTC on 2026-11-09, so today is still valid.
    expect(validateRequirementInput(withRaw({ deadline: "2026-11-09" }), NOW).ok).toBe(true);
  });

  it("refuses a deadline more than two years ahead", () => {
    expect(validateRequirementInput(withRaw({ deadline: "2030-01-01" }), NOW).ok).toBe(false);
    expect(validateRequirementInput(withRaw({ deadline: "2027-06-01" }), NOW).ok).toBe(true);
  });
});

describe("contact-detail masking in free text", () => {
  it("masks a phone number in notes, sets the flag, and keeps no raw digits", () => {
    const result = validateRequirementInput(withRaw({ notes: "Call 9876543210 after 6pm" }), NOW);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.flagged).toBe(true);
    expect(result.kinds).toContain("PHONE");
    expect(result.values.notes).toContain(MASK);
    expect(result.values.notes).not.toMatch(/9876543210/);
  });

  it("masks an email in shape and origin preference", () => {
    const result = validateRequirementInput(
      withRaw({ shape: "oval, mail me at buyer@example.com", originPreference: "Ceylon, write to buyer@example.com" }),
      NOW,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.values.shape).not.toMatch(/buyer@example\.com/);
    expect(result.values.originPreference).not.toMatch(/buyer@example\.com/);
    expect(result.kinds).toContain("EMAIL");
  });

  it("refuses notes that are too long", () => {
    const result = validateRequirementInput(withRaw({ notes: "x".repeat(2001) }), NOW);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fieldErrors.notes).toBeDefined();
  });
});
