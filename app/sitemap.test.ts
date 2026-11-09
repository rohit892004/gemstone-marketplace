import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, unknown>;
type FindManyArgs = { where?: unknown };

const db = vi.hoisted(() => ({
  gemstone: { findMany: vi.fn<(args: FindManyArgs) => Promise<Row[]>>(async () => []) },
  sellerProfile: { findMany: vi.fn<(args: FindManyArgs) => Promise<Row[]>>(async () => []) },
  category: { findMany: vi.fn<(args: FindManyArgs) => Promise<Row[]>>(async () => []) },
}));

vi.mock("@/lib/db/client", () => ({ prisma: db }));
vi.mock("next/server", () => ({ connection: async () => undefined }));
vi.mock("@/lib/config/app-url", () => ({
  appUrl: (path: string) => `https://app.example${path}`,
}));

import sitemap from "./sitemap";
import { publicListingWhere } from "@/lib/listings/visibility";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("sitemap", () => {
  it("selects listings with the public visibility filter only", async () => {
    await sitemap();
    expect(db.gemstone.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: publicListingWhere() }),
    );
    const where = (db.gemstone.findMany.mock.calls[0] as unknown as [FindManyArgs])[0].where;
    expect(where).toEqual({
      status: "PUBLISHED",
      availability: { not: "HIDDEN" },
      seller: { approvalStatus: "APPROVED" },
    });
  });

  it("lists only approved sellers", async () => {
    await sitemap();
    expect(db.sellerProfile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { approvalStatus: "APPROVED" } }),
    );
  });

  it("uses absolute URLs for listings, sellers and categories", async () => {
    db.gemstone.findMany.mockResolvedValueOnce([{ slug: "blue-sapphire-1", updatedAt: new Date("2026-01-01") }]);
    db.sellerProfile.findMany.mockResolvedValueOnce([{ slug: "gem-house", updatedAt: new Date("2026-01-01") }]);
    db.category.findMany.mockResolvedValueOnce([{ slug: "sapphire" }]);

    const entries = await sitemap();
    const urls = entries.map((e) => e.url);
    expect(urls).toContain("https://app.example/gemstones/blue-sapphire-1");
    expect(urls).toContain("https://app.example/sellers/gem-house");
    expect(urls).toContain("https://app.example/categories/sapphire");
    expect(urls).toContain("https://app.example/");
    expect(urls.every((u) => u.startsWith("https://app.example/"))).toBe(true);
  });
});
