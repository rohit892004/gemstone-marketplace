import { beforeEach, describe, expect, it, vi } from "vitest";

// Unit tests for the locked check-then-write guards. The real race (two transactions, one seller row) needs a
// database and is covered by a DB-level test that is not run in this environment. These tests check the ordering
// and the counts: the lock is taken first, the count runs on the transaction client, and the excluded listing is
// not counted against itself.

type Row = Record<string, unknown>;
type Where = Record<string, unknown>;

const h = vi.hoisted(() => {
  const tx = {
    $queryRaw: vi.fn((_strings: TemplateStringsArray, ..._values: unknown[]) => Promise.resolve([] as Row[])),
    sellerMembership: { findUnique: vi.fn((_args: unknown) => Promise.resolve(null as Row | null)) },
    gemstone: {
      count: vi.fn((_args: unknown) => Promise.resolve(0)),
      findFirst: vi.fn((_args: unknown) => Promise.resolve(null as Row | null)),
    },
  };
  return {
    tx,
    prisma: {
      tierRule: { findMany: vi.fn(() => Promise.resolve([] as Row[])) },
      sellerMembership: tx.sellerMembership,
      gemstone: tx.gemstone,
      $queryRaw: tx.$queryRaw,
      $transaction: vi.fn((fn: (client: typeof tx) => Promise<unknown>) => fn(tx)),
    },
  };
});

vi.mock("@/lib/db/client", () => ({ prisma: h.prisma }));
vi.mock("@/lib/audit/audit", () => ({ recordAudit: vi.fn() }));
vi.mock("@/lib/notifications/service", () => ({ notify: vi.fn(), NOTIFICATION_TYPES: {} }));

import { assertCanPublishListing, assertFeaturedSlot, withSellerLock } from "./service";

function whereOf(callIndex: number): Where {
  return (h.tx.gemstone.count.mock.calls[callIndex][0] as { where: Where }).where;
}

beforeEach(() => {
  vi.clearAllMocks();
  h.tx.gemstone.count.mockImplementation((_args: unknown) => Promise.resolve(0));
  h.tx.gemstone.findFirst.mockImplementation((_args: unknown) => Promise.resolve(null));
  h.tx.sellerMembership.findUnique.mockImplementation((_args: unknown) => Promise.resolve(null));
});

describe("withSellerLock", () => {
  it("takes the SellerProfile row lock before running the work", async () => {
    const order: string[] = [];
    h.tx.$queryRaw.mockImplementationOnce((_strings, ..._values) => {
      order.push("lock");
      return Promise.resolve([]);
    });
    await withSellerLock("seller_1", async () => {
      order.push("work");
    });
    expect(order).toEqual(["lock", "work"]);
    const lockSql = (h.tx.$queryRaw.mock.calls[0] as unknown as [TemplateStringsArray])[0].join("?");
    expect(lockSql).toMatch(/FOR UPDATE/);
    expect(lockSql).toMatch(/SellerProfile/);
  });
});

describe("assertCanPublishListing inside the lock", () => {
  it("counts on the transaction client and leaves the listing being published out of the count", async () => {
    h.tx.gemstone.count.mockResolvedValueOnce(3);
    await assertCanPublishListing("seller_1", "gem_9", h.tx as never);
    expect(h.tx.gemstone.count).toHaveBeenCalledTimes(1);
    expect(whereOf(0).NOT).toEqual({ id: "gem_9" });
  });

  it("refuses when the count is at the FREE tier limit (25)", async () => {
    h.tx.gemstone.count.mockResolvedValueOnce(25);
    await expect(assertCanPublishListing("seller_1", undefined, h.tx as never)).rejects.toMatchObject({ code: "LIMIT" });
  });

  it("allows one below the limit", async () => {
    h.tx.gemstone.count.mockResolvedValueOnce(24);
    await expect(assertCanPublishListing("seller_1", undefined, h.tx as never)).resolves.toBeUndefined();
  });
});

describe("assertFeaturedSlot inside the lock", () => {
  it("refuses a FREE seller, who has no featured slots", async () => {
    await expect(assertFeaturedSlot("seller_1", "gem_1", h.tx as never)).rejects.toMatchObject({
      code: "LIMIT",
      message: "Featured listings are a Premium and Elite benefit.",
    });
  });

  it("allows a listing that is already featured without re-counting", async () => {
    h.tx.gemstone.findFirst.mockResolvedValueOnce({ sellerFeatured: true });
    await expect(assertFeaturedSlot("seller_1", "gem_1", h.tx as never)).resolves.toBeUndefined();
    expect(h.tx.gemstone.count).not.toHaveBeenCalled();
  });

  it("refuses when the premium slots are used by other listings", async () => {
    h.tx.sellerMembership.findUnique.mockResolvedValueOnce({ tier: "PREMIUM" });
    h.tx.gemstone.findFirst.mockResolvedValueOnce({ sellerFeatured: false });
    h.tx.gemstone.count.mockResolvedValueOnce(1); // Premium has one featured slot in the defaults
    await expect(assertFeaturedSlot("seller_1", "gem_1", h.tx as never)).rejects.toMatchObject({ code: "LIMIT" });
    expect(whereOf(0).NOT).toEqual({ id: "gem_1" });
  });
});
