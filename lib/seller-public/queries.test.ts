import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  sellerFindFirst: vi.fn(),
  sellerFindMany: vi.fn(),
  sellerCount: vi.fn(),
  gemstoneFindMany: vi.fn(),
  gemstoneCount: vi.fn(),
  reviewFindMany: vi.fn(),
}));

vi.mock("@/lib/db/client", () => ({
  prisma: {
    sellerProfile: {
      findFirst: db.sellerFindFirst,
      findMany: db.sellerFindMany,
      count: db.sellerCount,
    },
    gemstone: { findMany: db.gemstoneFindMany, count: db.gemstoneCount },
    review: { findMany: db.reviewFindMany },
  },
}));

vi.mock("@/lib/listings/search", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/listings/search")>();
  return { ...actual, loadCards: vi.fn(async () => []) };
});

import { getApprovedReviews, getPublicSellerBySlug, listSellerGemstones } from "./queries";

beforeEach(() => {
  vi.clearAllMocks();
  db.sellerFindFirst.mockResolvedValue(null);
  db.gemstoneFindMany.mockResolvedValue([]);
  db.gemstoneCount.mockResolvedValue(0);
  db.reviewFindMany.mockResolvedValue([]);
});

describe("getPublicSellerBySlug", () => {
  it("only ever looks up APPROVED sellers", async () => {
    await getPublicSellerBySlug("acme-gems");
    expect(db.sellerFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { slug: "acme-gems", approvalStatus: "APPROVED" },
      }),
    );
  });

  it("selects only public profile fields (no contact, GST, address, pincode or documents)", async () => {
    await getPublicSellerBySlug("acme-gems");
    const select = db.sellerFindFirst.mock.calls[0][0].select as Record<string, boolean>;
    for (const forbidden of ["userId", "gstNumber", "addressLine", "pincode", "logoKey", "bannerKey", "approvedById"]) {
      expect(select).not.toHaveProperty(forbidden);
    }
  });
});

describe("listSellerGemstones (seller-public wrapper)", () => {
  it("always includes publicListingWhere alongside the seller filter", async () => {
    await listSellerGemstones("seller_1", 1);
    const expected = expect.objectContaining({
      sellerId: "seller_1",
      status: "PUBLISHED",
      availability: { not: "HIDDEN" },
      seller: { approvalStatus: "APPROVED" },
    });
    expect(db.gemstoneFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: expected }));
    expect(db.gemstoneCount).toHaveBeenCalledWith({ where: expected });
  });

  it("uses the same where clause for the count as for the page", async () => {
    await listSellerGemstones("seller_1", 2);
    const pageWhere = db.gemstoneFindMany.mock.calls[0][0].where;
    expect(db.gemstoneCount.mock.calls[0][0].where).toEqual(pageWhere);
  });

  it("computes the skip from the page number", async () => {
    await listSellerGemstones("seller_1", 3);
    expect(db.gemstoneFindMany.mock.calls[0][0]).toMatchObject({ skip: 48, take: 24 });
  });
});

describe("getApprovedReviews", () => {
  it("returns only APPROVED reviews", async () => {
    await getApprovedReviews("seller_1");
    expect(db.reviewFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { sellerId: "seller_1", status: "APPROVED" } }),
    );
  });
});
