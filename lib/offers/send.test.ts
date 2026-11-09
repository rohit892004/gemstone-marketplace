import { describe, expect, it, vi } from "vitest";
import { MAX_MINOR } from "@/lib/money/money";
import { MASK } from "@/lib/messaging/moderation";
import { OFFER_NOTE_MAX, validateOfferInput } from "./send";

// The pure validator is tested without a database or auth. These modules are mocked so the import
// graph does not load next-auth (which needs the Next runtime) or open a database connection.
vi.mock("@/lib/db/client", () => ({ prisma: {} }));
vi.mock("@/lib/audit/audit", () => ({ recordAudit: vi.fn() }));
vi.mock("@/lib/notifications/service", () => ({ notify: vi.fn(), NOTIFICATION_TYPES: {} }));
vi.mock("@/lib/messaging/service", () => ({
  CONTACT_WARNING: "Contact details are hidden.",
  MessagingError: class MessagingError extends Error {},
  assertCanMessage: vi.fn(),
}));

const base = { amountMinor: BigInt(1250000), currency: "INR" };

describe("validateOfferInput amount", () => {
  it("accepts a positive integer in minor units", () => {
    const result = validateOfferInput(base);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.amountMinor).toBe(BigInt(1250000));
  });

  it("accepts the maximum allowed amount", () => {
    expect(validateOfferInput({ ...base, amountMinor: MAX_MINOR }).ok).toBe(true);
  });

  it("refuses zero, negative and oversized amounts", () => {
    expect(validateOfferInput({ ...base, amountMinor: BigInt(0) }).ok).toBe(false);
    expect(validateOfferInput({ ...base, amountMinor: BigInt(-100) }).ok).toBe(false);
    expect(validateOfferInput({ ...base, amountMinor: MAX_MINOR + BigInt(1) }).ok).toBe(false);
  });

  it("refuses a non-bigint amount, so floats never reach the database", () => {
    const bad = { amountMinor: 1250.5 as unknown as bigint, currency: "INR" };
    expect(validateOfferInput(bad).ok).toBe(false);
  });
});

describe("validateOfferInput currency", () => {
  it("accepts INR and USD only", () => {
    expect(validateOfferInput({ ...base, currency: "INR" }).ok).toBe(true);
    expect(validateOfferInput({ ...base, currency: "USD" }).ok).toBe(true);
    expect(validateOfferInput({ ...base, currency: "EUR" }).ok).toBe(false);
    expect(validateOfferInput({ ...base, currency: "inr" }).ok).toBe(false);
    expect(validateOfferInput({ ...base, currency: "" }).ok).toBe(false);
  });
});

describe("validateOfferInput note", () => {
  it("treats a blank or missing note as no note", () => {
    for (const note of [undefined, null, "", "   "]) {
      const result = validateOfferInput({ ...base, note });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.note.text).toBeNull();
        expect(result.note.flagged).toBe(false);
      }
    }
  });

  it("trims a clean note and keeps it", () => {
    const result = validateOfferInput({ ...base, note: "  Firm for cash on pickup  " });
    expect(result.ok && result.note.text).toBe("Firm for cash on pickup");
  });

  it("accepts exactly the maximum length and refuses one more character", () => {
    expect(validateOfferInput({ ...base, note: "a".repeat(OFFER_NOTE_MAX) }).ok).toBe(true);
    expect(validateOfferInput({ ...base, note: "a".repeat(OFFER_NOTE_MAX + 1) }).ok).toBe(false);
  });

  it("masks a phone number and flags it", () => {
    const result = validateOfferInput({ ...base, note: "Call me on 9876543210 to close" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.note.flagged).toBe(true);
    expect(result.note.kinds).toContain("PHONE");
    expect(result.note.text).toContain(MASK);
    expect(result.note.text).not.toMatch(/9876543210/);
  });

  it("masks an email address and a messaging handle", () => {
    const result = validateOfferInput({ ...base, note: "mail dealer@example.com or whatsapp 9876543210" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.note.kinds).toEqual(expect.arrayContaining(["EMAIL", "PLATFORM"]));
    expect(result.note.text).not.toMatch(/dealer@example\.com/);
    expect(result.note.text).not.toMatch(/9876543210/);
  });

  it("masks spelled-out digits", () => {
    const result = validateOfferInput({ ...base, note: "ring nine eight seven six five four three two one" });
    expect(result.ok && result.note.flagged).toBe(true);
    expect(result.ok && result.note.text).not.toMatch(/987654321/);
  });
});
