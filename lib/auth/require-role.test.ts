import { beforeEach, describe, expect, it, vi } from "vitest";

// Mocks are hoisted. Each test sets the state it needs through these mocks.
const state = vi.hoisted(() => ({
  session: null as null | { user: { id: string; role: string }; issuedAt?: number },
  dbUser: null as null | Record<string, unknown>,
}));

vi.mock("@/lib/auth/auth", () => ({
  auth: vi.fn(async () => state.session),
}));

vi.mock("@/lib/db/client", () => ({
  prisma: {
    user: { findUnique: vi.fn(async () => state.dbUser) },
  },
}));

vi.mock("next/server", () => ({
  connection: async () => undefined,
}));

vi.mock("@/lib/audit/audit", () => ({
  recordAudit: vi.fn(async () => undefined),
}));

import { AuthzError, checkRole, requireApiRole, requireRole } from "./require-role";

const verifiedActiveBuyer = {
  id: "u_buyer",
  email: "buyer@example.com",
  name: "Asha",
  role: "BUYER",
  status: "ACTIVE",
  emailVerifiedAt: new Date("2026-01-01"),
  passwordChangedAt: null,
  sellerProfile: null,
};

function sellerWith(approvalStatus: string) {
  return {
    ...verifiedActiveBuyer,
    id: "u_seller",
    role: "SELLER",
    sellerProfile: { approvalStatus },
  };
}

beforeEach(() => {
  state.session = { user: { id: "u_buyer", role: "BUYER" }, issuedAt: Math.floor(Date.now() / 1000) };
  state.dbUser = { ...verifiedActiveBuyer };
});

describe("requireRole", () => {
  it("returns the current user for an allowed role", async () => {
    const user = await requireRole(["BUYER"]);
    expect(user).toMatchObject({ id: "u_buyer", role: "BUYER", sellerApproval: null });
  });

  it("throws UNAUTHENTICATED without a session", async () => {
    state.session = null;
    await expect(requireRole(["BUYER"])).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
  });

  it("throws UNAUTHENTICATED when the user row no longer exists", async () => {
    state.dbUser = null;
    await expect(requireRole(["BUYER"])).rejects.toBeInstanceOf(AuthzError);
  });

  it("refuses a role that is not allowed (buyer cannot reach admin)", async () => {
    await expect(requireRole(["ADMIN"])).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("refuses unverified email even with a valid session", async () => {
    state.dbUser = { ...verifiedActiveBuyer, emailVerifiedAt: null };
    await expect(requireRole(["BUYER"])).rejects.toMatchObject({ code: "EMAIL_NOT_VERIFIED" });
  });

  it("refuses suspended accounts immediately, using DB state not the token", async () => {
    state.dbUser = { ...verifiedActiveBuyer, status: "SUSPENDED" };
    await expect(requireRole(["BUYER"])).rejects.toMatchObject({ code: "ACCOUNT_SUSPENDED" });
  });

  it("revokes sessions issued before the last password change", async () => {
    const issuedAt = Math.floor(Date.now() / 1000) - 3600;
    state.session = { user: { id: "u_buyer", role: "BUYER" }, issuedAt };
    state.dbUser = { ...verifiedActiveBuyer, passwordChangedAt: new Date() };
    await expect(requireRole(["BUYER"])).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
  });

  it("keeps sessions issued after the last password change", async () => {
    state.dbUser = { ...verifiedActiveBuyer, passwordChangedAt: new Date(Date.now() - 3600_000) };
    await expect(requireRole(["BUYER"])).resolves.toMatchObject({ id: "u_buyer" });
  });
});

describe("seller gating", () => {
  beforeEach(() => {
    state.session = { user: { id: "u_seller", role: "SELLER" }, issuedAt: Math.floor(Date.now() / 1000) };
  });

  it("lets a PENDING seller reach the 'under review' area (no sellerApproved flag)", async () => {
    state.dbUser = sellerWith("PENDING");
    await expect(requireRole(["SELLER"])).resolves.toMatchObject({ sellerApproval: "PENDING" });
  });

  it("blocks a PENDING seller from approved-only seller features", async () => {
    state.dbUser = sellerWith("PENDING");
    await expect(requireRole(["SELLER"], { sellerApproved: true })).rejects.toMatchObject({
      code: "SELLER_NOT_APPROVED",
    });
  });

  it("blocks a REJECTED seller from approved-only seller features", async () => {
    state.dbUser = sellerWith("REJECTED");
    await expect(requireRole(["SELLER"], { sellerApproved: true })).rejects.toMatchObject({
      code: "SELLER_NOT_APPROVED",
    });
  });

  it("lets an APPROVED seller use approved-only features", async () => {
    state.dbUser = sellerWith("APPROVED");
    await expect(requireRole(["SELLER"], { sellerApproved: true })).resolves.toMatchObject({
      sellerApproval: "APPROVED",
    });
  });

  it("blocks a SUSPENDED seller from everything seller-side", async () => {
    state.dbUser = sellerWith("SUSPENDED");
    await expect(requireRole(["SELLER"])).rejects.toMatchObject({ code: "SELLER_SUSPENDED" });
  });
});

describe("checkRole and requireApiRole", () => {
  it("checkRole returns a result instead of throwing", async () => {
    await expect(checkRole(["ADMIN"])).resolves.toEqual({ ok: false, code: "FORBIDDEN" });
  });

  it("requireApiRole returns 401 when unauthenticated and 403 when forbidden", async () => {
    state.session = null;
    const unauth = await requireApiRole(["BUYER"]);
    expect(unauth.ok).toBe(false);
    if (!unauth.ok) expect(unauth.response.status).toBe(401);

    state.session = { user: { id: "u_buyer", role: "BUYER" } };
    const forbidden = await requireApiRole(["ADMIN"]);
    expect(forbidden.ok).toBe(false);
    if (!forbidden.ok) expect(forbidden.response.status).toBe(403);
  });
});
