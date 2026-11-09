import { beforeEach, describe, expect, it } from "vitest";
import { listingDefaults, minorToMajorInput, parseListingForm } from "./listing-form";

const valid: Record<string, string> = {
  title: "3.2 ct Blue Sapphire",
  categoryId: "cat_1",
  species: "Sapphire",
  variety: "",
  shape: "Oval",
  cut: "",
  caratWeight: "3.2",
  dimensions: "",
  colour: "Blue",
  clarity: "",
  origin: "Ceylon",
  treatment: "Unheated",
  certificateLabId: "",
  certificateNo: "",
  quantity: "1",
  priceMode: "PRICE",
  price: "12,500.50",
  currency: "INR",
  availability: "AVAILABLE",
  description: "",
  intent: "draft",
};

function form(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries({ ...valid, ...overrides })) fd.set(key, value);
  return fd;
}

beforeEach(() => {
  process.env.DATABASE_URL = "postgresql://u:p@localhost:5432/db";
});

describe("parseListingForm price handling", () => {
  it("parses a major-unit price into minor units", () => {
    const result = parseListingForm(form());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.priceMinor).toBe(BigInt(1250050));
    expect(result.value.priceOnRequest).toBe(false);
  });

  it("stores no price when the listing is price on request, ignoring any typed price", () => {
    const result = parseListingForm(form({ priceMode: "ON_REQUEST", price: "not a price" }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.priceMinor).toBeNull();
    expect(result.value.priceOnRequest).toBe(true);
  });

  it("requires a price in PRICE mode", () => {
    const result = parseListingForm(form({ price: "" }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.fieldErrors.price).toBeDefined();
  });

  it("rejects negative, exponent and over-precise prices", () => {
    for (const bad of ["-5", "1e6", "10.123", "abc", "0"]) {
      const result = parseListingForm(form({ price: bad }));
      expect(result.ok, bad).toBe(false);
      if (!result.ok) expect(result.fieldErrors.price, bad).toBeDefined();
    }
  });

  it("rejects a currency other than INR or USD", () => {
    const result = parseListingForm(form({ currency: "EUR" }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fieldErrors.currency).toBeDefined();
  });

  it("returns the submitted values with errors so the form can repopulate", () => {
    const result = parseListingForm(form({ title: "" }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.fieldErrors.title).toBeDefined();
    expect(result.values.species).toBe("Sapphire");
  });

  it("maps the intent field: submit only when asked", () => {
    const submit = parseListingForm(form({ intent: "submit" }));
    expect(submit.ok && submit.value.intent).toBe("submit");
    const draft = parseListingForm(form({ intent: "anything-else" }));
    expect(draft.ok && draft.value.intent).toBe("draft");
  });
});

describe("minorToMajorInput and defaults", () => {
  it("formats minor units for the price field", () => {
    expect(minorToMajorInput(BigInt(1250000))).toBe("12500");
    expect(minorToMajorInput(BigInt(1250050))).toBe("12500.50");
    expect(minorToMajorInput(BigInt(5))).toBe("0.05");
    expect(minorToMajorInput(null)).toBe("");
  });

  it("builds editor defaults from a stored listing", () => {
    const defaults = listingDefaults({
      title: "Ruby",
      categoryId: null,
      species: "Ruby",
      variety: null,
      shape: null,
      cut: null,
      caratWeight: { toString: () => "1.250" },
      dimensions: null,
      colour: null,
      clarity: null,
      origin: null,
      treatment: null,
      certificateLabId: null,
      certificateNo: null,
      quantity: 2,
      priceMinor: null,
      priceOnRequest: true,
      currency: "USD",
      availability: "HIDDEN",
      description: null,
    });
    expect(defaults).toMatchObject({ title: "Ruby", caratWeight: "1.250", priceMode: "ON_REQUEST", price: "", quantity: "2", currency: "USD" });
  });
});
