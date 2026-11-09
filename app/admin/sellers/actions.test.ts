import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  session: null as null | { user: { id: string; role: string }; issuedAt?: number },
  dbUser: null as null | Record<string, unknown>,
  seller: null as null | Record<string, unknown>,
  updateCount: 1,
}));

const db = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  sellerProfile: { findUnique: vi.fn(), updateMany: vi.fn() },
}));

vi.mock("@/lib/auth/auth", () => ({
  auth: vi.fn(async () => state.session),
}));

vi.mock("@/lib/db/client", () => ({ prisma: db }));

vi.mock("next/server", () => ({
  connection: async () => undefined,
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers({ "x-forwarded-for": "203.0.113.9" })),
}));

vi.mock("@/lib/audit/audit", () => ({
  recordAudit: vi.fn(async () => undefined),
}));

vi.mock("@/lib/config/app-url", () => ({
  appUrl: (path: string) => `https://app.test${path}`,
}));

import { recordAudit } from "@/lib/audit/audit";
import { AuthzError } from "@/lib/auth/require-role";
import { MemoryEmailProvider, setEmailProviderForTests } from "@/lib/notify/email";
import { revalidatePath } from "next/cache";
import { approveSeller, reactivateSeller, rejectSeller, suspendSeller } from "./actions";

const admin = {
  id: "u_admin",
  email: "admin@example.com",
  name: "Platform Admin",
  role: "ADMIN",
  status: "ACTIVE",
  emailVerifiedAt: new Date("2026-01-01"),
  passwordChangedAt: null,
  sellerProfile: null,
};

const SELLER_ID = "sp_1";

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [k, v] of Object.entries(fields)) data.set(k, v);
  return data;
}

function sellerRow(status: string) {
  return {
    id: SELLER_ID,
    businessName: "Jaipur Gems",
    approvalStatus: status,
    user: { email: "seller@example.com", name: "Asha Seller" },
  };
}

const memoryEmail = new MemoryEmailProvider();

beforeEach(() => {
  state.session = { user: { id: "u_admin", role: "ADMIN" }, issuedAt: Math.floor(Date.now() / 1000) };
  state.dbUser = { ...admin };
  db.user.findUnique.mockImplementation(async () => state.dbUser);
  db.sellerProfile.findUnique.mockImplementation(async () => state.seller);
  db.sellerProfile.updateMany.mockImplementation(async () => ({ count: state.updateCount }));
  state.seller = sellerRow("PENDING");
  state.updateCount = 1;
  memoryEmail.sent.length = 0;
  setEmailProviderForTests(memoryEmail);
});

afterEach(() => {
  setEmailProviderForTests(undefined);
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("approveSeller", () => {
  it("moves a PENDING seller to APPROVED, sets reviewer fields and clears the rejection reason", async () => {
    const result = await approveSeller(null, form({ sellerId: SELLER_ID }));

    expect(result).toMatchObject({ ok: true });
    expect(db.sellerProfile.updateMany).toHaveBeenCalledWith({
      where: { id: SELLER_ID, approvalStatus: { in: ["PENDING", "REJECTED"] } },
      data: expect.objectContaining({
        approvalStatus: "APPROVED",
        approvedById: "u_admin",
        approvedAt: expect.any(Date),
        reviewedAt: expect.any(Date),
        rejectionReason: null,
      }),
    });
  });

  it("emails the seller the approval template and records SELLER_APPROVED", async () => {
    await approveSeller(null, form({ sellerId: SELLER_ID }));

    expect(memoryEmail.sent).toHaveLength(1);
    expect(memoryEmail.sent[0]).toMatchObject({
      to: "seller@example.com",
      subject: "Your seller account is approved",
    });
    expect(memoryEmail.sent[0].text).toContain("https://app.test/login");
    expect(recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "seller.approved",
        actorId: "u_admin",
        entityType: "SellerProfile",
        entityId: SELLER_ID,
        ip: "203.0.113.9",
      }),
    );
    expect(revalidatePath).toHaveBeenCalledWith(`/admin/sellers/${SELLER_ID}`);
  });

  it("returns the friendly error when the status changed underneath (count 0)", async () => {
    state.updateCount = 0;
    const result = await approveSeller(null, form({ sellerId: SELLER_ID }));

    expect(result).toEqual({ ok: false, error: expect.stringContaining("status changed") });
    expect(memoryEmail.sent).toHaveLength(0);
    expect(recordAudit).not.toHaveBeenCalled();
  });

  it("returns an error for a missing seller without touching the row", async () => {
    state.seller = null;
    const result = await approveSeller(null, form({ sellerId: SELLER_ID }));

    expect(result).toEqual({ ok: false, error: "Seller not found." });
    expect(db.sellerProfile.updateMany).not.toHaveBeenCalled();
  });

  it("refuses a non-admin with FORBIDDEN and changes nothing", async () => {
    state.dbUser = { ...admin, id: "u_buyer", role: "BUYER" };
    state.session = { user: { id: "u_buyer", role: "BUYER" }, issuedAt: Math.floor(Date.now() / 1000) };

    await expect(approveSeller(null, form({ sellerId: SELLER_ID }))).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(approveSeller(null, form({ sellerId: SELLER_ID }))).rejects.toBeInstanceOf(AuthzError);
    expect(db.sellerProfile.updateMany).not.toHaveBeenCalled();
  });

  it("keeps the approval when the email fails, and logs the error", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    setEmailProviderForTests({
      send: vi.fn(async () => {
        throw new Error("smtp down");
      }),
    });

    const result = await approveSeller(null, form({ sellerId: SELLER_ID }));

    expect(result).toMatchObject({ ok: true });
    expect(db.sellerProfile.updateMany).toHaveBeenCalledTimes(1);
    expect(recordAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "seller.approved" }));
    expect(errorSpy).toHaveBeenCalled();
  });
});

describe("rejectSeller", () => {
  const reason = "GST certificate is unreadable, please upload a clear copy.";

  it("moves a PENDING seller to REJECTED with the reason stored", async () => {
    const result = await rejectSeller(null, form({ sellerId: SELLER_ID, reason }));

    expect(result).toMatchObject({ ok: true });
    expect(db.sellerProfile.updateMany).toHaveBeenCalledWith({
      where: { id: SELLER_ID, approvalStatus: { in: ["PENDING"] } },
      data: expect.objectContaining({ approvalStatus: "REJECTED", rejectionReason: reason, reviewedAt: expect.any(Date) }),
    });
  });

  it("requires a reason of at least 10 characters", async () => {
    const result = await rejectSeller(null, form({ sellerId: SELLER_ID, reason: "too short" }));

    expect(result).toMatchObject({ ok: false });
    expect(db.sellerProfile.updateMany).not.toHaveBeenCalled();
    expect(recordAudit).not.toHaveBeenCalled();
  });

  it("rejects an empty reason", async () => {
    const result = await rejectSeller(null, form({ sellerId: SELLER_ID, reason: "   " }));
    expect(result).toMatchObject({ ok: false });
    expect(db.sellerProfile.updateMany).not.toHaveBeenCalled();
  });

  it("emails the rejection template with the reason and records SELLER_REJECTED", async () => {
    await rejectSeller(null, form({ sellerId: SELLER_ID, reason }));

    expect(memoryEmail.sent[0]).toMatchObject({
      to: "seller@example.com",
      subject: "Update on your seller application",
    });
    expect(memoryEmail.sent[0].text).toContain(reason);
    expect(recordAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "seller.rejected" }));
  });

  it("returns the friendly error for a stale status", async () => {
    state.updateCount = 0;
    const result = await rejectSeller(null, form({ sellerId: SELLER_ID, reason }));
    expect(result).toEqual({ ok: false, error: expect.stringContaining("status changed") });
    expect(memoryEmail.sent).toHaveLength(0);
  });

  it("refuses a non-admin with FORBIDDEN", async () => {
    state.dbUser = { ...admin, role: "SELLER" };
    state.session = { user: { id: "u_admin", role: "SELLER" }, issuedAt: Math.floor(Date.now() / 1000) };
    await expect(rejectSeller(null, form({ sellerId: SELLER_ID, reason }))).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(db.sellerProfile.updateMany).not.toHaveBeenCalled();
  });

  it("keeps the rejection when the email fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    setEmailProviderForTests({
      send: vi.fn(async () => {
        throw new Error("smtp down");
      }),
    });
    const result = await rejectSeller(null, form({ sellerId: SELLER_ID, reason }));
    expect(result).toMatchObject({ ok: true });
    expect(db.sellerProfile.updateMany).toHaveBeenCalledTimes(1);
  });
});

describe("suspendSeller", () => {
  const reason = "Repeated misrepresentation of stone origin in listings.";

  it("suspends only an APPROVED seller and requires a reason", async () => {
    state.seller = sellerRow("APPROVED");
    const result = await suspendSeller(null, form({ sellerId: SELLER_ID, reason }));

    expect(result).toMatchObject({ ok: true });
    expect(db.sellerProfile.updateMany).toHaveBeenCalledWith({
      where: { id: SELLER_ID, approvalStatus: { in: ["APPROVED"] } },
      data: expect.objectContaining({ approvalStatus: "SUSPENDED", reviewedAt: expect.any(Date) }),
    });
  });

  it("refuses without a reason", async () => {
    const result = await suspendSeller(null, form({ sellerId: SELLER_ID, reason: "" }));
    expect(result).toMatchObject({ ok: false });
    expect(db.sellerProfile.updateMany).not.toHaveBeenCalled();
  });

  it("emails the suspension template and records SELLER_SUSPENDED", async () => {
    state.seller = sellerRow("APPROVED");
    await suspendSeller(null, form({ sellerId: SELLER_ID, reason }));

    expect(memoryEmail.sent[0]).toMatchObject({
      to: "seller@example.com",
      subject: "Your seller account has been suspended",
    });
    expect(memoryEmail.sent[0].text).toContain(reason);
    expect(recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "seller.suspended", meta: { reason } }),
    );
  });

  it("returns the friendly error when the seller is no longer APPROVED", async () => {
    state.updateCount = 0;
    const result = await suspendSeller(null, form({ sellerId: SELLER_ID, reason }));
    expect(result).toEqual({ ok: false, error: expect.stringContaining("status changed") });
  });

  it("refuses a non-admin with FORBIDDEN", async () => {
    state.dbUser = { ...admin, role: "BUYER" };
    state.session = { user: { id: "u_admin", role: "BUYER" }, issuedAt: Math.floor(Date.now() / 1000) };
    await expect(suspendSeller(null, form({ sellerId: SELLER_ID, reason }))).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});

describe("reactivateSeller", () => {
  it("moves a SUSPENDED seller back to APPROVED and records SELLER_REACTIVATED", async () => {
    state.seller = sellerRow("SUSPENDED");
    const result = await reactivateSeller(null, form({ sellerId: SELLER_ID }));

    expect(result).toMatchObject({ ok: true });
    expect(db.sellerProfile.updateMany).toHaveBeenCalledWith({
      where: { id: SELLER_ID, approvalStatus: { in: ["SUSPENDED"] } },
      data: expect.objectContaining({ approvalStatus: "APPROVED", reviewedAt: expect.any(Date) }),
    });
    expect(recordAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "seller.reactivated" }));
    expect(memoryEmail.sent[0]).toMatchObject({ to: "seller@example.com", subject: "Your seller account is approved" });
  });

  it("returns the friendly error when the seller is not SUSPENDED any more", async () => {
    state.updateCount = 0;
    const result = await reactivateSeller(null, form({ sellerId: SELLER_ID }));
    expect(result).toEqual({ ok: false, error: expect.stringContaining("status changed") });
    expect(recordAudit).not.toHaveBeenCalled();
  });

  it("refuses a non-admin with FORBIDDEN", async () => {
    state.dbUser = { ...admin, role: "SELLER" };
    state.session = { user: { id: "u_admin", role: "SELLER" }, issuedAt: Math.floor(Date.now() / 1000) };
    await expect(reactivateSeller(null, form({ sellerId: SELLER_ID }))).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});
