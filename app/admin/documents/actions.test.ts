import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  session: null as null | { user: { id: string }; issuedAt?: number },
  dbUser: null as null | Record<string, unknown>,
}));

const db = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  listingDocument: { findUnique: vi.fn(), updateMany: vi.fn() },
}));

const audit = vi.hoisted(() => ({ recordAudit: vi.fn(async () => undefined) }));

vi.mock("@/lib/auth/auth", () => ({ auth: vi.fn(async () => state.session) }));
vi.mock("@/lib/db/client", () => ({ prisma: db }));
vi.mock("@/lib/audit/audit", () => audit);
vi.mock("next/server", () => ({ connection: async () => undefined }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));

import { MemoryEmailProvider, setEmailProviderForTests } from "@/lib/notify/email";
import { rejectListingDocument, verifyListingDocument } from "./actions";

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

const doc = {
  id: "d1",
  title: "GIA report",
  gemstone: {
    title: "Blue Sapphire",
    seller: { businessName: "Gem House", user: { email: "seller@example.test", name: null } },
  },
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
  db.listingDocument.findUnique.mockResolvedValue(doc);
  db.listingDocument.updateMany.mockResolvedValue({ count: 1 });
  mail = new MemoryEmailProvider();
  setEmailProviderForTests(mail);
});

describe("verifyListingDocument", () => {
  it("sets verification fields only and never changes isPublic", async () => {
    const result = await verifyListingDocument(null, form({ documentId: "d1" }));

    expect(result).toMatchObject({ ok: true });
    const call = db.listingDocument.updateMany.mock.calls[0][0] as { where: unknown; data: Record<string, unknown> };
    expect(call.where).toEqual({ id: "d1", verificationStatus: "PENDING" });
    expect(call.data).toMatchObject({ verificationStatus: "VERIFIED", verifiedById: "u_admin" });
    expect(Object.keys(call.data)).not.toContain("isPublic");
  });

  it("audits the decision and emails the seller", async () => {
    await verifyListingDocument(null, form({ documentId: "d1" }));
    expect(audit.recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "listing_document.verified", actorId: "u_admin", entityId: "d1" }),
    );
    expect(mail.sent[0]).toMatchObject({ to: "seller@example.test" });
    expect(mail.sent[0].text).toContain("does not make the document public");
  });

  it("returns a friendly error when the document was already decided", async () => {
    db.listingDocument.updateMany.mockResolvedValueOnce({ count: 0 });
    const result = await verifyListingDocument(null, form({ documentId: "d1" }));
    expect(result).toMatchObject({ ok: false });
    expect(audit.recordAudit).not.toHaveBeenCalled();
  });

  it("refuses non-admins", async () => {
    state.dbUser = { ...admin, role: "SELLER", sellerProfile: { approvalStatus: "APPROVED" } };
    await expect(verifyListingDocument(null, form({ documentId: "d1" }))).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.listingDocument.updateMany).not.toHaveBeenCalled();
  });
});

describe("rejectListingDocument", () => {
  it("requires a reason of at least 10 characters", async () => {
    const result = await rejectListingDocument(null, form({ documentId: "d1", reason: "bad" }));
    expect(result).toMatchObject({ ok: false });
    expect(db.listingDocument.updateMany).not.toHaveBeenCalled();
  });

  it("rejects with the reason, audits, and emails it", async () => {
    const reason = "The certificate number does not match the report.";
    const result = await rejectListingDocument(null, form({ documentId: "d1", reason }));

    expect(result).toMatchObject({ ok: true });
    expect(db.listingDocument.updateMany).toHaveBeenCalledWith({
      where: { id: "d1", verificationStatus: "PENDING" },
      data: expect.objectContaining({ verificationStatus: "REJECTED", verificationReason: reason }),
    });
    expect(audit.recordAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "listing_document.rejected" }));
    expect(mail.sent[0].text).toContain(reason);
  });
});
