import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Valuator account rules: a deactivated valuator (status SUSPENDED) is refused everywhere, a valuator can only
 * see and act on requests assigned to them, and the queue never selects requester fields.
 */

const state = vi.hoisted(() => ({
  session: null as null | { user: { id: string; role: string }; issuedAt?: number },
  dbUser: null as null | Record<string, unknown>,
}));

vi.mock("@/lib/auth/auth", () => ({ auth: vi.fn(async () => state.session) }));
vi.mock("@/lib/db/client", () => ({ prisma: { user: { findUnique: vi.fn(async () => state.dbUser) } } }));
vi.mock("next/server", () => ({ connection: async () => undefined }));
vi.mock("@/lib/audit/audit", () => ({ recordAudit: vi.fn(async () => undefined) }));

import { checkRole } from "@/lib/auth/require-role";
import { canActAsValuator, canViewValuation, valuatorCanWorkOn } from "./access";
import { parseValuatorInput } from "./admin-valuators";
import { VALUATOR_QUEUE_SELECT } from "./valuator-queue";

function valuatorRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "val_1",
    email: "valuer@example.test",
    name: "Meera",
    role: "VALUATOR",
    status: "ACTIVE",
    emailVerifiedAt: new Date("2026-01-01"),
    passwordChangedAt: null,
    sellerProfile: null,
    ...overrides,
  };
}

describe("valuator sign-in and role gate", () => {
  beforeEach(() => {
    state.session = { user: { id: "val_1", role: "VALUATOR" }, issuedAt: Math.floor(Date.now() / 1000) };
    state.dbUser = valuatorRow();
  });

  it("lets an active, verified valuator through the valuator gate", async () => {
    const result = await checkRole(["VALUATOR"]);
    expect(result.ok).toBe(true);
  });

  it("refuses a deactivated valuator (SUSPENDED) even with a live session", async () => {
    state.dbUser = valuatorRow({ status: "SUSPENDED" });
    expect(await checkRole(["VALUATOR"])).toEqual({ ok: false, code: "ACCOUNT_SUSPENDED" });
  });

  it("refuses a valuator who has not set a password yet (email not verified)", async () => {
    state.dbUser = valuatorRow({ emailVerifiedAt: null });
    expect(await checkRole(["VALUATOR"])).toEqual({ ok: false, code: "EMAIL_NOT_VERIFIED" });
  });

  it("refuses a valuator at admin pages", async () => {
    expect(await checkRole(["ADMIN"])).toEqual({ ok: false, code: "FORBIDDEN" });
  });
});

describe("valuator assignment rules", () => {
  const assigned = { requesterId: "buyer_1", assignedValuatorId: "val_1", status: "IN_EXPERT_REVIEW", withdrawnAt: null };
  const other = { ...assigned, assignedValuatorId: "val_2" };
  const valuator = { id: "val_1", role: "VALUATOR" as const };

  it("a valuator may view and act only on their own assignments", () => {
    expect(canViewValuation(valuator, assigned)).toBe(true);
    expect(canViewValuation(valuator, other)).toBe(false);
    expect(canActAsValuator(valuator, other)).toBe(false);
  });

  it("a valuator may not work on a withdrawn or finished request", () => {
    expect(valuatorCanWorkOn(valuator, assigned)).toBe(true);
    expect(valuatorCanWorkOn(valuator, { ...assigned, withdrawnAt: new Date() })).toBe(false);
    expect(valuatorCanWorkOn(valuator, { ...assigned, status: "COMPLETED" })).toBe(false);
  });

  it("a valuator who is not assigned cannot view an unassigned request", () => {
    expect(canViewValuation(valuator, { ...assigned, assignedValuatorId: null })).toBe(false);
  });
});

describe("valuator queue least privilege", () => {
  it("selects only the stone and status fields, never the requester, listing or seller", () => {
    const keys = Object.keys(VALUATOR_QUEUE_SELECT);
    expect(keys.sort()).toEqual(
      ["caratMilli", "expertReasons", "gemstoneType", "id", "reference", "status", "submittedAt"].sort(),
    );
    for (const forbidden of ["requester", "requesterId", "gemstone", "gemstoneId", "seller", "listingSellerUserId", "email", "name"]) {
      expect(keys).not.toContain(forbidden);
    }
  });
});

describe("parseValuatorInput", () => {
  it("normalises email and strips spaces from the mobile number", () => {
    const result = parseValuatorInput({ name: " Meera Rao ", email: " Meera@Example.Test ", mobile: "+91 98765 43210" });
    expect(result).toEqual({
      ok: true,
      value: { name: "Meera Rao", email: "meera@example.test", mobile: "+919876543210" },
    });
  });

  it("allows a blank mobile number", () => {
    expect(parseValuatorInput({ name: "A", email: "a@example.test", mobile: "" })).toEqual({
      ok: true,
      value: { name: "A", email: "a@example.test", mobile: "" },
    });
  });

  it("refuses a missing name, a bad email and a bad mobile number", () => {
    expect(parseValuatorInput({ name: " ", email: "a@example.test", mobile: "" }).ok).toBe(false);
    expect(parseValuatorInput({ name: "A", email: "not-an-email", mobile: "" }).ok).toBe(false);
    expect(parseValuatorInput({ name: "A", email: "a@example.test", mobile: "12-ab" }).ok).toBe(false);
  });
});
