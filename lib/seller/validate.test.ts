import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/config/env", () => ({
  getEnv: () => ({ UPLOAD_MAX_MB: 10 }),
}));

import type { CategoryOption } from "./category-selection";
import type { CertificateLabOption } from "./labs";
import { validateSellerRegistration } from "./validate";
import type { SellerRegistrationInput } from "./types";

const labs: CertificateLabOption[] = [{ id: "lab_gia", code: "gia", name: "GIA", isOther: false }];
const categories: CategoryOption[] = [
  { id: "cat_diamond", name: "Diamond", slug: "diamond" },
  { id: "cat_ruby", name: "Ruby", slug: "ruby" },
];

const PDF = Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.alloc(64)]);

function input(overrides: Partial<SellerRegistrationInput> = {}): SellerRegistrationInput {
  return {
    name: "Asha Rao",
    email: "asha@example.com",
    mobile: "+919812345678",
    password: "correct-horse-1",
    country: "India",
    businessName: "Rao Gems",
    businessType: "PARTNERSHIP",
    gstNumber: "",
    addressLine: "12 MG Road, Jaipur",
    city: "Jaipur",
    state: "Rajasthan",
    businessCountry: "India",
    pincode: "",
    yearsInBusiness: "12",
    specialties: ["Ruby"],
    categoryIds: ["cat_ruby"],
    idProof: { name: "id.pdf", size: PDF.length, data: PDF },
    businessProof: { name: "gst.pdf", size: PDF.length, data: PDF },
    certificates: [],
    ...overrides,
  };
}

describe("validateSellerRegistration: public business name", () => {
  it("refuses a business name with contact details, on the businessName field", () => {
    const result = validateSellerRegistration(input({ businessName: "Asha Gems, call 98765 43210" }), labs, categories);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fieldErrors.businessName).toContain("Business name");
  });

  it("accepts an ordinary business name", () => {
    const result = validateSellerRegistration(input({ businessName: "Asha Gems" }), labs, categories);
    expect(result.ok).toBe(true);
  });
});

describe("validateSellerRegistration: gemstone categories", () => {
  it("passes the chosen categories through in list order", () => {
    const result = validateSellerRegistration(input({ categoryIds: ["cat_ruby", "cat_diamond"] }), labs, categories);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.categoryIds).toEqual(["cat_diamond", "cat_ruby"]);
  });

  it("reports a missing category on the categoryIds field", () => {
    const result = validateSellerRegistration(input({ categoryIds: [] }), labs, categories);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fieldErrors.categoryIds).toBe("Choose at least one gemstone category");
  });

  it("reports an unknown category on the categoryIds field", () => {
    const result = validateSellerRegistration(input({ categoryIds: ["cat_pearl"] }), labs, categories);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fieldErrors.categoryIds).toBe("Choose categories from the list");
  });

  it("reports the category error together with other field errors", () => {
    const result = validateSellerRegistration(input({ categoryIds: [], businessName: "R" }), labs, categories);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.fieldErrors.categoryIds).toBeDefined();
      expect(result.fieldErrors.businessName).toBeDefined();
    }
  });

  it("refuses when no categories are offered at all", () => {
    const result = validateSellerRegistration(input(), labs, []);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fieldErrors.categoryIds).toMatch(/No gemstone categories are available/);
  });
});
