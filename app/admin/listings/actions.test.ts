import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  session: null as null | { user: { id: string }; issuedAt?: number },
  dbUser: null as null | Record<string, unknown>,
}));

const db = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  gemstone: { findUnique: vi.fn(), updateMany: vi.fn() },
}));

const audit = vi.hoisted(() => ({ recordAudit: vi.fn(async () => undefined) }));

vi.mock("@/lib/auth/auth", () => ({ auth: vi.fn(async () => state.session) }));
vi.mock("@/lib/db/client", () => ({ prisma: db }));
vi.mock("@/lib/audit/audit", () => audit);
vi.mock("next/server", () => ({ connection: async () => undefined }));
vi.mock("@/lib/membership/service", () => ({
  assertCanPublishListing: vi.fn(async () => undefined),
  MembershipError: class MembershipError extends Error {},
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": "198.51.100.7" }),
}));
vi.mock("@/lib/config/app-url", () => ({
  appUrl: (path: string) => `https://app.example${path}`,
}));

import { AuthzError } from "@/lib/auth/require-role";
import { MemoryEmailProvider, setEmailProviderForTests } from "@/lib/notify/email";
import { approveListing, rejectListing, setListingFeatured } from "./actions";
import { assertCanPublishListing, MembershipError } from "@/lib/membership/service";

const admin = {
  id: "u_admin",
  email: "admin@example.test",
  name: "Admin",
  role: "ADMIN",
  status: "ACTIVE",
  emailVerifiedAt: new Date("2026-01-01"),
  passwordChangedAt: null,
  sellerProfile: null,
};

const listing = {
  id: "g1",
  title: "Blue Sapphire, 2.10 ct Oval",
  slug: "blue-sapphire-2-10-oval",
  seller: { businessName: "Himalaya Gem House", user: { email: "seller@example.test", name: "Seller Name" } },
};

function form(values: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(values)) fd.set(k, v);
  return fd;
}

let mail: MemoryEmailProvider;

beforeEach(() => {
  vi.clearAllMocks();
  state.session = { user: { id: "u_admin" }, issuedAt: Math.floor(Date.now() / 1000) };
  state.dbUser = { ...admin };
  db.user.findUnique.mockImplementation(async () => state.dbUser);
  db.gemstone.findUnique.mockResolvedValue(listing);
  db.gemstone.updateMany.mockResolvedValue({ count: 1 });
  mail = new MemoryEmailProvider();
  setEmailProviderForTests(mail);
});

describe("approveListing", () => {
  it("updates only a PENDING_REVIEW listing, sets publish fields, audits and emails the seller", async () => {
    const result = await approveListing(null, form({ listingId: "g1" }));

    expect(result).toMatchObject({ ok: true });
    expect(db.gemstone.updateMany).toHaveBeenCalledWith({
      where: { id: "g1", status: "PENDING_REVIEW" },
      data: expect.objectContaining({ status: "PUBLISHED", reviewedById: "u_admin", publishedAt: expect.any(Date) }),
    });
    expect(audit.recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "listing.approved",
        actorId: "u_admin",
        entityType: "Gemstone",
        entityId: "g1",
        ip: "198.51.100.7",
      }),
    );
    expect(mail.sent).toHaveLength(1);
    expect(mail.sent[0]).toMatchObject({ to: "seller@example.test" });
    expect(mail.sent[0].text).toContain("https://app.example/gemstones/blue-sapphire-2-10-oval");
  });

  it("returns a friendly error and does not audit or email when the status already changed", async () => {
    db.gemstone.updateMany.mockResolvedValueOnce({ count: 0 });

    const result = await approveListing(null, form({ listingId: "g1" }));

    expect(result).toEqual({
      ok: false,
      error: expect.stringContaining("changed while you were working"),
    });
    expect(audit.recordAudit).not.toHaveBeenCalled();
    expect(mail.sent).toHaveLength(0);
  });

  it("refuses to publish over the seller's listing limit, and does not change the listing", async () => {
    vi.mocked(assertCanPublishListing).mockRejectedValueOnce(new MembershipError("LIMIT", "limit"));
    const result = await approveListing(null, form({ listingId: "g1" }));
    expect(result.ok).toBe(false);
    expect(db.gemstone.updateMany).not.toHaveBeenCalled();
    expect(audit.recordAudit).not.toHaveBeenCalled();
  });

  it("refuses non-admins before touching the listing", async () => {
    state.dbUser = { ...admin, role: "BUYER" };
    await expect(approveListing(null, form({ listingId: "g1" }))).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.gemstone.updateMany).not.toHaveBeenCalled();
  });

  it("refuses a seller account too", async () => {
    state.dbUser = { ...admin, role: "SELLER", sellerProfile: { approvalStatus: "APPROVED" } };
    await expect(approveListing(null, form({ listingId: "g1" }))).rejects.toBeInstanceOf(AuthzError);
    expect(db.gemstone.updateMany).not.toHaveBeenCalled();
  });
});

describe("rejectListing", () => {
  it("refuses a reason shorter than 10 characters", async () => {
    const result = await rejectListing(null, form({ listingId: "g1", reason: "no" }));
    expect(result).toMatchObject({ ok: false });
    expect(db.gemstone.updateMany).not.toHaveBeenCalled();
  });

  it("rejects a pending listing with the reason, audits and emails the reason", async () => {
    const reason = "Photos are too blurred to judge the colour.";
    const result = await rejectListing(null, form({ listingId: "g1", reason }));

    expect(result).toMatchObject({ ok: true });
    expect(db.gemstone.updateMany).toHaveBeenCalledWith({
      where: { id: "g1", status: "PENDING_REVIEW" },
      data: expect.objectContaining({ status: "REJECTED", rejectionReason: reason }),
    });
    expect(audit.recordAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "listing.rejected", entityId: "g1" }));
    expect(mail.sent[0].text).toContain(reason);
  });

  it("returns the stale-status error when the listing is no longer pending", async () => {
    db.gemstone.updateMany.mockResolvedValueOnce({ count: 0 });
    const result = await rejectListing(null, form({ listingId: "g1", reason: "Photos are too blurred." }));
    expect(result).toMatchObject({ ok: false });
    expect(audit.recordAudit).not.toHaveBeenCalled();
    expect(mail.sent).toHaveLength(0);
  });
});

describe("setListingFeatured", () => {
  it("sets featured only when the current value differs, and audits the new value", async () => {
    const result = await setListingFeatured(null, form({ listingId: "g1", featured: "true" }));

    expect(result).toMatchObject({ ok: true });
    expect(db.gemstone.updateMany).toHaveBeenCalledWith({
      where: { id: "g1", featured: false },
      data: { featured: true },
    });
    expect(audit.recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "listing.featured_changed", meta: { featured: true } }),
    );
  });

  it("refuses non-admins", async () => {
    state.dbUser = { ...admin, role: "BUYER" };
    await expect(setListingFeatured(null, form({ listingId: "g1", featured: "true" }))).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});
