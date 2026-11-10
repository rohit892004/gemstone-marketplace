import { describe, expect, it } from "vitest";
import {
  DETAIL_FIELDS,
  detailFieldForError,
  detailsRawFromFormData,
  looksLikePhoto,
  looksLikeVideo,
  notesCountLabel,
  photosRemaining,
  submitBlockReason,
} from "./requester-form";
import { valuationErrorMessage, GENERIC_VALUATION_ERROR, ACCOUNT_CANNOT_ACT } from "./requester-errors";

describe("detailsRawFromFormData", () => {
  it("returns every detail field, with missing fields as empty strings", () => {
    const form = new FormData();
    form.set("gemstoneType", "Sapphire");
    form.set("carat", "1.5");
    const raw = detailsRawFromFormData(form);
    expect(Object.keys(raw).sort()).toEqual([...DETAIL_FIELDS].sort());
    expect(raw.gemstoneType).toBe("Sapphire");
    expect(raw.carat).toBe("1.5");
    expect(raw.origin).toBe("");
  });

  it("ignores file values in a text field", () => {
    const form = new FormData();
    form.set("notes", new File(["x"], "a.txt", { type: "text/plain" }));
    expect(detailsRawFromFormData(form).notes).toBe("");
  });
});

describe("detailFieldForError", () => {
  it("points carat errors at the carat field", () => {
    expect(detailFieldForError("Enter the carat weight.")).toBe("carat");
    expect(detailFieldForError("Carat weight must be between 0.01 and 10,000 ct, with at most three decimals.")).toBe("carat");
  });

  it("points the gemstone type and notes errors at their fields", () => {
    expect(detailFieldForError("Choose the gemstone type.")).toBe("gemstoneType");
    expect(detailFieldForError("Notes cannot include phone numbers, email addresses or links. Contact goes through the platform.")).toBe("notes");
  });

  it("returns null for a message that names no field", () => {
    expect(detailFieldForError("Check the details and try again.")).toBeNull();
  });
});

describe("submitBlockReason", () => {
  it("blocks submit with no photo and says why", () => {
    const reason = submitBlockReason(0);
    expect(reason).toMatch(/at least one photo/i);
  });

  it("allows submit with one photo or more", () => {
    expect(submitBlockReason(1)).toBeNull();
    expect(submitBlockReason(12)).toBeNull();
  });
});

describe("photo helpers", () => {
  it("counts remaining photo slots and never goes negative", () => {
    expect(photosRemaining(0)).toBe(12);
    expect(photosRemaining(5)).toBe(7);
    expect(photosRemaining(12)).toBe(0);
    expect(photosRemaining(20)).toBe(0);
  });

  it("recognises photo and video types for the client hint", () => {
    expect(looksLikePhoto({ type: "image/jpeg" })).toBe(true);
    expect(looksLikePhoto({ type: "image/gif" })).toBe(false);
    expect(looksLikeVideo({ type: "video/mp4" })).toBe(true);
    expect(looksLikeVideo({ type: "video/quicktime" })).toBe(false);
  });

  it("labels the notes count", () => {
    expect(notesCountLabel(12)).toBe("12 of 1000 characters");
  });
});

describe("valuationErrorMessage", () => {
  it("passes a ValuationError message through, including rate limit and contact details text", () => {
    const rate = Object.assign(new Error("You have reached the limit."), { name: "ValuationError" });
    const contact = Object.assign(new Error("Notes cannot include phone numbers."), { name: "ValuationError" });
    expect(valuationErrorMessage(rate)).toBe("You have reached the limit.");
    expect(valuationErrorMessage(contact)).toBe("Notes cannot include phone numbers.");
  });

  it("gives a fixed message for an authorisation error", () => {
    expect(valuationErrorMessage(Object.assign(new Error("FORBIDDEN"), { name: "AuthzError" }))).toBe(ACCOUNT_CANNOT_ACT);
  });

  it("hides the detail of any other error", () => {
    expect(valuationErrorMessage(new Error("connect ECONNREFUSED 127.0.0.1:54330"))).toBe(GENERIC_VALUATION_ERROR);
    expect(valuationErrorMessage("boom")).toBe(GENERIC_VALUATION_ERROR);
  });
});
