import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/client", () => ({ prisma: {} }));

import { formatCarat, money } from "./display";
import { parsePriceCell } from "./admin-prices";
import { buildValuationView, type ViewRecord } from "./view";

/**
 * What a valuator's page can contain. A valuator sees the stone and the thread, never the requester's identity.
 * The check is on the serialised view, so no field can carry the requester through a side door.
 */

const REQUESTER = { id: "buyer_77", name: "Priya Requester", email: "priya.requester@example.test" };

function record(): ViewRecord {
  return {
    id: "v_9",
    reference: "GSV-26-AB2CD3",
    requesterId: REQUESTER.id,
    source: "LISTING",
    status: "IN_EXPERT_REVIEW",
    gemstoneId: "gem_9",
    listingSellerUserId: "seller_9",
    gemstoneType: "Ruby",
    categoryName: "Ruby",
    shape: null,
    caratMilli: 1500,
    dimensions: null,
    colour: null,
    clarity: null,
    qualityGrade: null,
    origin: null,
    treatment: null,
    labName: null,
    certificateNumber: null,
    notes: null,
    currency: "INR",
    requestExpert: true,
    expertReasons: ["REQUESTED"],
    autoEstimateMinor: BigInt(1000000),
    autoLowMinor: BigInt(900000),
    autoHighMinor: BigInt(1100000),
    autoConfidence: "LOW",
    finalEstimateMinor: null,
    finalLowMinor: null,
    finalHighMinor: null,
    finalConfidence: null,
    assignedValuatorId: "val_9",
    assignedValuator: { id: "val_9", name: "Meera Valuer" },
    rejectionReason: null,
    withdrawnAt: null,
    withdrawnReason: null,
    publishedOnListing: false,
    submittedAt: new Date("2026-11-01T00:00:00Z"),
    completedAt: null,
    createdAt: new Date("2026-10-31T00:00:00Z"),
    requester: REQUESTER,
    media: [{ id: "m_9", kind: "IMAGE", mimeType: "image/webp", sortOrder: 0 }],
    thread: [
      { id: "n_1", kind: "INFO_REQUEST", body: "Which lab?", createdAt: new Date(), authorId: "val_9", authorRole: "VALUATOR" },
      { id: "n_2", kind: "INFO_RESPONSE", body: "GIA.", createdAt: new Date(), authorId: REQUESTER.id, authorRole: "BUYER" },
    ],
  };
}

describe("valuator view privacy", () => {
  const view = buildValuationView({ id: "val_9", role: "VALUATOR" }, record());
  const serialised = JSON.stringify(view, (_key, value) => (typeof value === "bigint" ? value.toString() : value));

  it("contains no requester identity, id, email or listing field", () => {
    expect(serialised).not.toContain(REQUESTER.email);
    expect(serialised).not.toContain(REQUESTER.name);
    expect(serialised).not.toContain(REQUESTER.id);
    expect(serialised).not.toContain("gem_9");
    expect(serialised).not.toContain("seller_9");
    expect(view).not.toHaveProperty("requester");
    expect(view).not.toHaveProperty("gemstoneId");
    expect(view).not.toHaveProperty("assignedValuatorName");
    expect(view).not.toHaveProperty("publishedOnListing");
  });

  it("labels thread authors by role, never by name", () => {
    expect(view.thread.map((t) => t.from)).toEqual(["VALUATOR", "REQUESTER"]);
    expect(serialised).not.toContain("Meera Valuer");
  });

  it("does not expose the withdrawal reason to valuators", () => {
    expect(buildValuationView({ id: "val_9", role: "VALUATOR" }, { ...record(), withdrawnAt: new Date(), withdrawnReason: "internal" }).withdrawnReason).toBeNull();
  });
});

describe("display helpers", () => {
  it("formats carat from thousandths", () => {
    expect(formatCarat(2500)).toBe("2.5 ct");
    expect(formatCarat(1)).toBe("0.001 ct");
    expect(formatCarat(null)).toBe("-");
  });

  it("formats minor units without floats", () => {
    expect(money(BigInt(1250050), "INR")).toContain("12,500.50");
    expect(money(null, "INR")).toBe("-");
  });
});

describe("parsePriceCell", () => {
  const base = { gemstoneType: "Ruby", currency: "INR", qualityGrade: "FINE", band: "UNDER_1", priceMajor: "50000.00" };

  it("accepts a valid cell and returns BigInt minor units", () => {
    expect(parsePriceCell(base)).toEqual({
      ok: true,
      value: { gemstoneType: "Ruby", currency: "INR", qualityGrade: "FINE", band: "UNDER_1", pricePerCaratMinor: BigInt(5000000) },
    });
  });

  it("refuses an unknown type, currency, grade, band or price", () => {
    expect(parsePriceCell({ ...base, gemstoneType: "Unicorn" }).ok).toBe(false);
    expect(parsePriceCell({ ...base, currency: "EUR" }).ok).toBe(false);
    expect(parsePriceCell({ ...base, qualityGrade: "GOOD" }).ok).toBe(false);
    expect(parsePriceCell({ ...base, band: "3_TO_4" }).ok).toBe(false);
    expect(parsePriceCell({ ...base, priceMajor: "0" }).ok).toBe(false);
    expect(parsePriceCell({ ...base, priceMajor: "1.5.5" }).ok).toBe(false);
  });
});
