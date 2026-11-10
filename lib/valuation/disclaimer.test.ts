import { describe, expect, it } from "vitest";
import { VALUATION_DISCLAIMER } from "./disclaimer";
import { DISCLAIMER_TEXT } from "./requester-copy";

describe("valuation disclaimer", () => {
  it("is one constant for the on-page copy and the PDF", () => {
    expect(DISCLAIMER_TEXT).toBe(VALUATION_DISCLAIMER);
    expect(VALUATION_DISCLAIMER).toContain("not a certified appraisal");
  });
});
