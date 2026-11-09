import { describe, expect, it } from "vitest";
import { parseSpecialties, SPECIALTY_MAX_COUNT, SPECIALTY_MAX_LENGTH, validatePortfolioText } from "./portfolio";

describe("parseSpecialties", () => {
  it("splits on commas and newlines, trims, and drops empties and case-insensitive duplicates", () => {
    expect(parseSpecialties(" Ruby, sapphire ,\n\nRUBY,, Emerald ")).toEqual(["Ruby", "sapphire", "Emerald"]);
  });
});

describe("validatePortfolioText", () => {
  const base = { tagline: "", description: "", specialties: "" };

  it("accepts empty optional fields and stores them as null or []", () => {
    expect(validatePortfolioText(base)).toEqual({
      ok: true,
      value: { tagline: null, description: null, specialties: [] },
    });
  });

  it("allows exactly 20 specialties and rejects 21", () => {
    const twenty = Array.from({ length: SPECIALTY_MAX_COUNT }, (_, i) => `item${i}`).join(",");
    expect(validatePortfolioText({ ...base, specialties: twenty }).ok).toBe(true);
    const twentyOne = `${twenty},extra`;
    expect(validatePortfolioText({ ...base, specialties: twentyOne })).toMatchObject({ ok: false });
  });

  it("rejects a specialty longer than 40 characters", () => {
    const long = "x".repeat(SPECIALTY_MAX_LENGTH + 1);
    const result = validatePortfolioText({ ...base, specialties: long });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fieldErrors.specialties).toBeDefined();
  });

  it("limits the tagline to 120 characters", () => {
    expect(validatePortfolioText({ ...base, tagline: "t".repeat(121) }).ok).toBe(false);
  });
});
