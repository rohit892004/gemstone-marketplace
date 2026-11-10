import { describe, expect, it } from "vitest";
import { buildValuationView, effectiveResult, type ViewRecord } from "./view";

const REQUESTER = { id: "buyer_1", name: "Asha Buyer", email: "asha@example.test" };
const VALUATOR = { id: "val_1", name: "Ravi Valuer" };

function record(overrides: Partial<ViewRecord> = {}): ViewRecord {
  return {
    id: "v_1",
    reference: "GSV-26-K7Q2M9",
    requesterId: REQUESTER.id,
    source: "LISTING",
    status: "IN_EXPERT_REVIEW",
    gemstoneId: "gem_1",
    listingSellerUserId: "seller_1",
    gemstoneType: "Sapphire",
    categoryName: "Sapphire",
    shape: "Oval",
    caratMilli: 2500,
    dimensions: null,
    colour: "Blue",
    clarity: null,
    qualityGrade: "FINE",
    origin: "Sri Lanka",
    treatment: null,
    labName: "GIA",
    certificateNumber: "GIA-1",
    notes: "Stone is in the box.",
    currency: "INR",
    requestExpert: false,
    expertReasons: ["LOW_CONFIDENCE"],
    autoEstimateMinor: BigInt(12500000),
    autoLowMinor: BigInt(10000000),
    autoHighMinor: BigInt(15000000),
    autoConfidence: "MEDIUM",
    finalEstimateMinor: null,
    finalLowMinor: null,
    finalHighMinor: null,
    finalConfidence: null,
    assignedValuatorId: VALUATOR.id,
    assignedValuator: VALUATOR,
    rejectionReason: null,
    withdrawnAt: null,
    withdrawnReason: null,
    publishedOnListing: false,
    submittedAt: new Date("2026-11-10T08:00:00Z"),
    completedAt: null,
    createdAt: new Date("2026-11-10T07:59:00Z"),
    requester: REQUESTER,
    media: [{ id: "m_1", kind: "IMAGE", mimeType: "image/webp", sortOrder: 0 }],
    thread: [
      { id: "n_1", kind: "INFO_REQUEST", body: "Please send a girdle photo.", createdAt: new Date(), authorId: VALUATOR.id, authorRole: "VALUATOR" },
      { id: "n_2", kind: "INFO_RESPONSE", body: "Sent.", createdAt: new Date(), authorId: REQUESTER.id, authorRole: "BUYER" },
    ],
    ...overrides,
  };
}

const requester = { id: REQUESTER.id, role: "REQUESTER" as const };
const valuator = { id: VALUATOR.id, role: "VALUATOR" as const };
const admin = { id: "admin_1", role: "ADMIN" as const };

describe("buildValuationView: valuators", () => {
  it("never includes the requester's identity, the listing or the seller", () => {
    const view = buildValuationView(valuator, record());
    const json = JSON.stringify(view, (_k, v) => (typeof v === "bigint" ? v.toString() : v));
    expect(json).not.toContain(REQUESTER.email);
    expect(json).not.toContain(REQUESTER.name);
    expect(json).not.toContain(REQUESTER.id);
    expect(json).not.toContain("gem_1");
    expect(json).not.toContain("seller_1");
    expect(view).not.toHaveProperty("requester");
    expect(view).not.toHaveProperty("gemstoneId");
  });

  it("shows the thread authors by role, not by name", () => {
    const view = buildValuationView(valuator, record());
    expect(view.thread.map((t) => t.from)).toEqual(["VALUATOR", "REQUESTER"]);
  });

  it("sees the automatic suggestion while the request is open", () => {
    const view = buildValuationView(valuator, record());
    expect(view.autoSuggestion?.estimateMinor).toBe(BigInt(12500000));
    expect(view.result).toBeNull();
  });
});

describe("buildValuationView: requesters", () => {
  it("sees no result while the request is in expert review", () => {
    const view = buildValuationView(requester, record());
    expect(view.result).toBeNull();
    expect(view.autoSuggestion).toBeNull();
  });

  it("sees the automatic result once it is ready, labelled as automatic", () => {
    const view = buildValuationView(requester, record({ status: "AUTO_VALUED", expertReasons: [] }));
    expect(view.result?.valuedBy).toBe("AUTO");
    expect(view.result?.estimateMinor).toBe(BigInt(12500000));
  });

  it("sees the expert result after sign-off, labelled as expert", () => {
    const view = buildValuationView(
      requester,
      record({
        status: "COMPLETED",
        finalEstimateMinor: BigInt(13000000),
        finalLowMinor: BigInt(12000000),
        finalHighMinor: BigInt(14000000),
        finalConfidence: "HIGH",
      }),
    );
    expect(view.result?.valuedBy).toBe("EXPERT");
    expect(view.result?.estimateMinor).toBe(BigInt(13000000));
  });

  it("does not see the assigned valuator's name, but sees the thread", () => {
    const view = buildValuationView(requester, record());
    expect(view).not.toHaveProperty("assignedValuatorName");
    expect(view.thread).toHaveLength(2);
    expect(view.gemstoneId).toBe("gem_1");
  });

  it("sees the withdrawal reason and the withdrawn flag", () => {
    const view = buildValuationView(requester, record({ withdrawnAt: new Date(), withdrawnReason: "internal note" }));
    expect(view.withdrawn).toBe(true);
    expect(view.withdrawnReason).toBe("internal note");
  });
});

describe("buildValuationView: admins", () => {
  it("sees the requester and the assigned valuator", () => {
    const view = buildValuationView(admin, record());
    expect(view.requester).toEqual(REQUESTER);
    expect(view.assignedValuatorName).toBe(VALUATOR.name);
    expect(view.autoSuggestion?.valuedBy).toBe("AUTO");
  });
});

describe("effectiveResult", () => {
  it("is null for statuses without a result", () => {
    expect(effectiveResult(record({ status: "DRAFT" }))).toBeNull();
    expect(effectiveResult(record({ status: "NEEDS_INFO" }))).toBeNull();
    expect(effectiveResult(record({ status: "REJECTED" }))).toBeNull();
  });
  it("prefers the expert result over the automatic one when completed", () => {
    const result = effectiveResult(
      record({
        status: "COMPLETED",
        finalEstimateMinor: BigInt(1),
        finalLowMinor: BigInt(1),
        finalHighMinor: BigInt(1),
        finalConfidence: "LOW",
      }),
    );
    expect(result?.valuedBy).toBe("EXPERT");
  });
});
