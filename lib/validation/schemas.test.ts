import { describe, expect, it } from "vitest";
import {
  buyerRegisterSchema,
  loginSchema,
  mobileSchema,
  passwordSchema,
  sellerBusinessSchema,
} from "./schemas";

describe("mobileSchema", () => {
  it("normalises spaces and dashes to +digits", () => {
    expect(mobileSchema.parse("98123-45678")).toBe("+9812345678");
    expect(mobileSchema.parse("+91 98123 45678")).toBe("+919812345678");
  });

  it("rejects letters and too-short numbers", () => {
    expect(mobileSchema.safeParse("abc").success).toBe(false);
    expect(mobileSchema.safeParse("123").success).toBe(false);
  });
});

describe("passwordSchema", () => {
  it("requires 10+ characters with a letter and a number", () => {
    expect(passwordSchema.safeParse("short1").success).toBe(false);
    expect(passwordSchema.safeParse("alllettersonly").success).toBe(false);
    expect(passwordSchema.safeParse("1234567890").success).toBe(false);
    expect(passwordSchema.safeParse("goodpass123").success).toBe(true);
  });
});

describe("loginSchema", () => {
  it("lowercases and trims email, and does not apply password complexity", () => {
    const parsed = loginSchema.parse({ email: "  Buyer@Example.COM ", password: "x" });
    expect(parsed.email).toBe("buyer@example.com");
  });
});

describe("buyerRegisterSchema", () => {
  it("accepts a complete buyer registration", () => {
    const result = buyerRegisterSchema.safeParse({
      name: "Asha Verma",
      email: "asha@example.com",
      mobile: "+91 98123 45678",
      password: "goodpass123",
      country: "India",
    });
    expect(result.success).toBe(true);
  });
});

describe("sellerBusinessSchema", () => {
  const base = {
    businessName: "Jaipur Gems Co",
    businessType: "PARTNERSHIP",
    addressLine: "12 Johari Bazaar",
    city: "Jaipur",
    state: "Rajasthan",
    country: "India",
    yearsInBusiness: 12,
    specialties: ["Sapphire", "Ruby"],
  } as const;

  it("accepts a valid GST number and leaves it optional", () => {
    expect(sellerBusinessSchema.safeParse({ ...base, gstNumber: "08AABCU9603R1ZX" }).success).toBe(true);
    expect(sellerBusinessSchema.safeParse({ ...base, gstNumber: "" }).success).toBe(true);
    expect(sellerBusinessSchema.safeParse({ ...base }).success).toBe(true);
  });

  it("rejects a malformed GST number", () => {
    expect(sellerBusinessSchema.safeParse({ ...base, gstNumber: "NOT-A-GST" }).success).toBe(false);
  });

  it("requires at least one specialty", () => {
    expect(sellerBusinessSchema.safeParse({ ...base, specialties: [] }).success).toBe(false);
  });

  it("rejects an unknown business type", () => {
    expect(sellerBusinessSchema.safeParse({ ...base, businessType: "CHARITY" }).success).toBe(false);
  });
});
