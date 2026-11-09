import { beforeEach, describe, expect, it, vi } from "vitest";

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

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

vi.mock("@/lib/audit/audit", () => ({
  recordAudit: vi.fn(async () => undefined),
}));

import { requireRole } from "@/lib/auth/require-role";
import { gateApprovedSeller } from "./approved-gate";

const base = {
  id: "u_seller",
  email: "seller@example.com",
  name: "Ravi",
  role: "SELLER",
  status: "ACTIVE",
  emailVerifiedAt: new Date("2026-01-01"),
  passwordChangedAt: null,
};

function sellerWith(approvalStatus: string) {
  return { ...base, sellerProfile: { approvalStatus } };
}

beforeEach(() => {
  state.session = { user: { id: "u_seller", role: "SELLER" }, issuedAt: Math.floor(Date.now() / 1000) };
  state.dbUser = sellerWith("PENDING");
});

describe("approved-only seller helpers", () => {
  it("refuses a PENDING seller with SELLER_NOT_APPROVED", async () => {
    state.dbUser = sellerWith("PENDING");
    await expect(requireRole(["SELLER"], { sellerApproved: true })).rejects.toMatchObject({
      code: "SELLER_NOT_APPROVED",
    });
  });

  it("refuses a REJECTED seller with SELLER_NOT_APPROVED", async () => {
    state.dbUser = sellerWith("REJECTED");
    await expect(requireRole(["SELLER"], { sellerApproved: true })).rejects.toMatchObject({
      code: "SELLER_NOT_APPROVED",
    });
  });

  it("lets an APPROVED seller through", async () => {
    state.dbUser = sellerWith("APPROVED");
    await expect(requireRole(["SELLER"], { sellerApproved: true })).resolves.toMatchObject({
      sellerApproval: "APPROVED",
    });
  });

  it("blocks a SUSPENDED seller with SELLER_SUSPENDED, even on the under-review area", async () => {
    state.dbUser = sellerWith("SUSPENDED");
    await expect(requireRole(["SELLER"])).rejects.toMatchObject({ code: "SELLER_SUSPENDED" });
  });

  it("a buyer gets FORBIDDEN on seller routes", async () => {
    state.session = { user: { id: "u_buyer", role: "BUYER" } };
    state.dbUser = { ...base, id: "u_buyer", role: "BUYER", sellerProfile: null };
    await expect(requireRole(["SELLER"])).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("gateApprovedSeller (approved-only page gate)", () => {
  it("returns not_approved for a PENDING seller without leaking anything", async () => {
    state.dbUser = sellerWith("PENDING");
    await expect(gateApprovedSeller()).resolves.toBe("not_approved");
  });

  it("returns not_approved for a REJECTED seller", async () => {
    state.dbUser = sellerWith("REJECTED");
    await expect(gateApprovedSeller()).resolves.toBe("not_approved");
  });

  it("returns approved for an APPROVED seller", async () => {
    state.dbUser = sellerWith("APPROVED");
    await expect(gateApprovedSeller()).resolves.toBe("approved");
  });

  it("redirects a SUSPENDED seller to login instead of rendering", async () => {
    state.dbUser = sellerWith("SUSPENDED");
    await expect(gateApprovedSeller()).rejects.toThrow("NEXT_REDIRECT:/login?error=account_suspended");
  });

  it("redirects a buyer away from seller areas", async () => {
    state.session = { user: { id: "u_buyer", role: "BUYER" } };
    state.dbUser = { ...base, id: "u_buyer", role: "BUYER", sellerProfile: null };
    await expect(gateApprovedSeller()).rejects.toThrow("NEXT_REDIRECT:/dashboard");
  });

  it("redirects a signed-out visitor to login", async () => {
    state.session = null;
    await expect(gateApprovedSeller()).rejects.toThrow("NEXT_REDIRECT:/login");
  });
});
