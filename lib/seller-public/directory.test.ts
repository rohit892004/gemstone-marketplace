import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  findMany: vi.fn(),
  count: vi.fn(),
}));

vi.mock("@/lib/db/client", () => ({
  prisma: { sellerProfile: { findMany: db.findMany, count: db.count } },
}));

import { buildDirectoryWhere, searchSellers } from "./directory";

beforeEach(() => {
  vi.clearAllMocks();
  db.findMany.mockResolvedValue([]);
  db.count.mockResolvedValue(0);
});

describe("seller directory filter", () => {
  it("always requires APPROVED sellers, with no filters", () => {
    expect(buildDirectoryWhere({})).toEqual({ approvalStatus: "APPROVED", AND: [] });
  });

  it("keeps APPROVED when a search term is applied", () => {
    const where = buildDirectoryWhere({ q: "jaipur" });
    expect(where.approvalStatus).toBe("APPROVED");
    expect(JSON.stringify(where.AND)).toContain("jaipur");
  });

  it("keeps APPROVED when a specialty is applied", () => {
    const where = buildDirectoryWhere({ specialty: "Sapphire" });
    expect(where.approvalStatus).toBe("APPROVED");
    expect(where.AND).toEqual([{ specialties: { has: "Sapphire" } }]);
  });

  it("passes the approved-only where clause to both the page query and the count", async () => {
    await searchSellers({ q: "gems", specialty: "Ruby", page: 1 });
    const expected = expect.objectContaining({ approvalStatus: "APPROVED" });
    expect(db.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expected }));
    expect(db.count).toHaveBeenCalledWith({ where: expected });
  });

  it("sorts by rating, then review count, with nulls last", async () => {
    await searchSellers({ page: 1 });
    expect(db.findMany.mock.calls[0][0].orderBy).toEqual([
      { ratingAverage: { sort: "desc", nulls: "last" } },
      { reviewCount: "desc" },
      { id: "asc" },
    ]);
  });
});
