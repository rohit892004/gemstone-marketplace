import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  session: null as null | { user: { id: string; role: string }; issuedAt?: number },
  dbUser: null as null | Record<string, unknown>,
}));

const db = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  gemstoneFindFirst: vi.fn(),
  wishlistUpsert: vi.fn(),
  wishlistDeleteMany: vi.fn(),
}));

vi.mock("@/lib/auth/auth", () => ({
  auth: vi.fn(async () => state.session),
}));

vi.mock("@/lib/db/client", () => ({
  prisma: {
    user: { findUnique: db.userFindUnique },
    gemstone: { findFirst: db.gemstoneFindFirst },
    wishlistItem: { upsert: db.wishlistUpsert, deleteMany: db.wishlistDeleteMany },
  },
}));

vi.mock("next/server", () => ({
  connection: async () => undefined,
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
  notFound: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/audit/audit", () => ({
  recordAudit: vi.fn(async () => undefined),
}));

import { addToWishlist, removeFromWishlist } from "./actions";
import { WISHLIST_GENERIC_ERROR } from "./constants";

const buyer = {
  id: "u_buyer",
  email: "buyer@example.com",
  name: "Asha",
  role: "BUYER",
  status: "ACTIVE",
  emailVerifiedAt: new Date("2026-01-01"),
  passwordChangedAt: null,
  sellerProfile: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  state.session = { user: { id: "u_buyer", role: "BUYER" }, issuedAt: Math.floor(Date.now() / 1000) };
  state.dbUser = { ...buyer };
  db.userFindUnique.mockImplementation(async () => state.dbUser);
  db.gemstoneFindFirst.mockResolvedValue({ id: "g_1", seller: { userId: "u_other_seller" } });
  db.wishlistUpsert.mockResolvedValue({});
  db.wishlistDeleteMany.mockResolvedValue({ count: 1 });
});

describe("addToWishlist", () => {
  it("saves a public listing for a buyer", async () => {
    const result = await addToWishlist("g_1");
    expect(result).toEqual({ ok: true, saved: true });
    expect(db.wishlistUpsert).toHaveBeenCalledWith({
      where: { buyerId_gemstoneId: { buyerId: "u_buyer", gemstoneId: "g_1" } },
      create: { buyerId: "u_buyer", gemstoneId: "g_1" },
      update: {},
    });
  });

  it("is idempotent: saving twice is ok and never creates a duplicate row", async () => {
    const first = await addToWishlist("g_1");
    const second = await addToWishlist("g_1");
    expect(first).toEqual({ ok: true, saved: true });
    expect(second).toEqual({ ok: true, saved: true });
    // Both calls go through upsert with an empty update, so the second is a no-op in the database.
    expect(db.wishlistUpsert).toHaveBeenCalledTimes(2);
    for (const [args] of db.wishlistUpsert.mock.calls) expect(args.update).toEqual({});
  });

  it("only looks up listings through publicListingWhere (published, not hidden, approved seller)", async () => {
    await addToWishlist("g_1");
    expect(db.gemstoneFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "g_1",
          status: "PUBLISHED",
          availability: { not: "HIDDEN" },
          seller: { approvalStatus: "APPROVED" },
        }),
      }),
    );
  });

  it("refuses a non-public listing with a generic error and writes nothing", async () => {
    db.gemstoneFindFirst.mockResolvedValue(null);
    const result = await addToWishlist("g_draft");
    expect(result).toEqual({ ok: false, error: WISHLIST_GENERIC_ERROR });
    expect(db.wishlistUpsert).not.toHaveBeenCalled();
  });

  it("refuses a seller's own listing (OwnBusinessError) with a generic error", async () => {
    state.session = { user: { id: "u_seller", role: "SELLER" }, issuedAt: Math.floor(Date.now() / 1000) };
    state.dbUser = {
      ...buyer,
      id: "u_seller",
      role: "SELLER",
      sellerProfile: { approvalStatus: "APPROVED" },
    };
    db.gemstoneFindFirst.mockResolvedValue({ id: "g_1", seller: { userId: "u_seller" } });

    const result = await addToWishlist("g_1");
    expect(result).toEqual({ ok: false, error: WISHLIST_GENERIC_ERROR });
    expect(JSON.stringify(result)).not.toContain("OWN_BUSINESS");
    expect(db.wishlistUpsert).not.toHaveBeenCalled();
  });

  it("lets a seller save someone else's listing", async () => {
    state.session = { user: { id: "u_seller", role: "SELLER" }, issuedAt: Math.floor(Date.now() / 1000) };
    state.dbUser = { ...buyer, id: "u_seller", role: "SELLER", sellerProfile: { approvalStatus: "APPROVED" } };
    const result = await addToWishlist("g_1");
    expect(result).toEqual({ ok: true, saved: true });
  });

  it("returns a generic error when signed out and never trusts a client-sent user id", async () => {
    state.session = null;
    const result = await addToWishlist("g_1");
    expect(result).toEqual({ ok: false, error: WISHLIST_GENERIC_ERROR });
    expect(db.wishlistUpsert).not.toHaveBeenCalled();
  });

  it("rejects an empty listing id without touching the database", async () => {
    const result = await addToWishlist("   ");
    expect(result.ok).toBe(false);
    expect(db.gemstoneFindFirst).not.toHaveBeenCalled();
  });
});

describe("removeFromWishlist", () => {
  it("deletes only the caller's own row", async () => {
    const result = await removeFromWishlist("g_1");
    expect(result).toEqual({ ok: true, saved: false });
    expect(db.wishlistDeleteMany).toHaveBeenCalledWith({ where: { buyerId: "u_buyer", gemstoneId: "g_1" } });
  });

  it("is idempotent when the item is already gone", async () => {
    db.wishlistDeleteMany.mockResolvedValue({ count: 0 });
    await expect(removeFromWishlist("g_1")).resolves.toEqual({ ok: true, saved: false });
    await expect(removeFromWishlist("g_1")).resolves.toEqual({ ok: true, saved: false });
  });
});
