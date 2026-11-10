import sharp from "sharp";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetEnvCacheForTests } from "@/lib/config/env";
import { setStorageProviderForTests, type StorageProvider } from "@/lib/storage/storage";

const h = vi.hoisted(() => {
  const prisma = {
    gemstone: { findFirst: vi.fn(), updateMany: vi.fn(), create: vi.fn() },
    sellerProfile: { findUnique: vi.fn() },
    category: { findUnique: vi.fn() },
    gemstoneMedia: { findMany: vi.fn(), findFirst: vi.fn(), createMany: vi.fn(), delete: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    listingDocument: { count: vi.fn(), create: vi.fn(), findFirst: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn() },
    $transaction: vi.fn(),
    // Row lock used by the upload paths (SELECT ... FOR UPDATE on the listing).
    $queryRaw: vi.fn(async () => []),
  };
  prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(prisma));
  return {
    prisma,
    userId: "u_seller",
    autoPublish: false,
  };
});

vi.mock("@/lib/auth/require-role", () => ({
  requireRole: vi.fn(async () => ({ id: h.userId, role: "SELLER", sellerApproval: "APPROVED" })),
}));
vi.mock("@/lib/db/client", () => ({ prisma: h.prisma }));
vi.mock("@/lib/valuation/service", () => ({ unpublishValuationsOnStoneChange: vi.fn().mockResolvedValue(0) }));
vi.mock("@/lib/settings/app-settings", () => ({
  getBooleanSetting: vi.fn(async () => h.autoPublish),
}));
vi.mock("@/lib/seller/labs", () => ({
  loadActiveCertificateLabs: vi.fn(async () => [{ id: "lab_gia", code: "GIA", name: "GIA", isOther: false }]),
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
// Membership guards and follower notices are tested in lib/membership; here they always allow and do nothing.
vi.mock("@/lib/membership/service", () => ({
  assertCanPublishListing: vi.fn(async () => undefined),
  assertFeaturedSlot: vi.fn(async () => undefined),
  MembershipError: class MembershipError extends Error {},
}));
vi.mock("@/lib/membership/notify-followers", () => ({ notifyFollowersOfNewListing: vi.fn(async () => 0) }));

import { deleteDocumentAction, moveMediaAction, saveListingAction, uploadDocumentAction, uploadMediaAction } from "./actions";

/** In-memory storage so tests never touch disk. */
function fakeStorage() {
  const objects = new Map<string, Buffer>();
  const provider: StorageProvider = {
    put: async (key, data) => {
      objects.set(key, data);
    },
    get: async (key) => {
      const v = objects.get(key);
      if (!v) throw new Error("missing");
      return v;
    },
    delete: async (key) => {
      objects.delete(key);
    },
  };
  return { provider, objects };
}

let storage: ReturnType<typeof fakeStorage>;

beforeEach(() => {
  process.env.DATABASE_URL = "postgresql://u:p@localhost:5432/db";
  process.env.UPLOAD_MAX_MB = "5";
  resetEnvCacheForTests();
  vi.clearAllMocks();
  h.prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(h.prisma));
  h.userId = "u_seller";
  h.autoPublish = false;
  storage = fakeStorage();
  setStorageProviderForTests(storage.provider);
  h.prisma.sellerProfile.findUnique.mockResolvedValue({ id: "sp_1" });
  h.prisma.category.findUnique.mockResolvedValue({ id: "cat_1" });
  h.prisma.gemstone.findFirst.mockResolvedValue(null);
});

const listingFields: Record<string, string> = {
  title: "3.2 ct Blue Sapphire",
  categoryId: "cat_1",
  species: "Sapphire",
  caratWeight: "3.2",
  quantity: "1",
  priceMode: "PRICE",
  price: "12,500.50",
  currency: "INR",
  availability: "AVAILABLE",
  intent: "draft",
};

function listingForm(overrides: Record<string, string> = {}, listingId?: string): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries({ ...listingFields, ...overrides })) fd.set(k, v);
  if (listingId) fd.set("listingId", listingId);
  return fd;
}

async function expectRedirect(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("REDIRECT:")) return error.message.slice("REDIRECT:".length);
    throw error;
  }
  throw new Error("expected a redirect");
}

describe("ownership", () => {
  it("returns not found for another seller's listing when moving media", async () => {
    // Ownership lookup is scoped to the signed-in seller, so another seller's id finds nothing.
    h.prisma.gemstone.findFirst.mockResolvedValue(null);
    const fd = new FormData();
    fd.set("listingId", "other_listing");
    fd.set("mediaId", "m1");
    fd.set("direction", "up");
    await expect(moveMediaAction(fd)).rejects.toThrow("NEXT_NOT_FOUND");
    expect(h.prisma.gemstone.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "other_listing", seller: { userId: "u_seller" } } }),
    );
    expect(h.prisma.gemstoneMedia.update).not.toHaveBeenCalled();
  });

  it("does not update another seller's listing on save", async () => {
    h.prisma.gemstone.findFirst.mockResolvedValue(null);
    const result = await saveListingAction({}, listingForm({}, "other_listing"));
    expect(result).toEqual({ formError: "Listing not found." });
    expect(h.prisma.gemstone.updateMany).not.toHaveBeenCalled();
  });

  it("does not delete a document that belongs to another listing", async () => {
    h.prisma.gemstone.findFirst.mockResolvedValue({ id: "l1", status: "DRAFT" });
    h.prisma.listingDocument.findFirst.mockResolvedValue({ id: "d1", gemstoneId: "other", fileKey: "k", verificationStatus: "PENDING" });
    const fd = new FormData();
    fd.set("listingId", "l1");
    fd.set("documentId", "d1");
    await expect(deleteDocumentAction(fd)).rejects.toThrow("NEXT_NOT_FOUND");
    expect(h.prisma.listingDocument.deleteMany).not.toHaveBeenCalled();
  });
});

describe("submit and auto-publish", () => {
  it("saves a new draft as DRAFT and redirects to its editor", async () => {
    h.prisma.gemstone.create.mockResolvedValue({ id: "l_new" });
    const url = await expectRedirect(saveListingAction({}, listingForm({ intent: "draft" })));
    expect(url).toBe("/seller/listings/l_new/edit?saved=draft");
    expect(h.prisma.gemstone.create.mock.calls[0]?.[0].data).toMatchObject({ status: "DRAFT", submittedAt: undefined });
  });

  it("submits a new listing for review when auto-publish is off", async () => {
    h.prisma.gemstone.create.mockResolvedValue({ id: "l_new" });
    await expectRedirect(saveListingAction({}, listingForm({ intent: "submit" })));
    expect(h.prisma.gemstone.create.mock.calls[0]?.[0].data).toMatchObject({ status: "PENDING_REVIEW" });
    expect(h.prisma.gemstone.create.mock.calls[0]?.[0].data.submittedAt).toBeInstanceOf(Date);
    expect(h.prisma.gemstone.create.mock.calls[0]?.[0].data.publishedAt).toBeUndefined();
  });

  it("publishes on submit when auto-publish is on, setting publishedAt", async () => {
    h.autoPublish = true;
    h.prisma.gemstone.create.mockResolvedValue({ id: "l_new" });
    await expectRedirect(saveListingAction({}, listingForm({ intent: "submit" })));
    const data = h.prisma.gemstone.create.mock.calls[0]?.[0].data;
    expect(data.status).toBe("PUBLISHED");
    expect(data.publishedAt).toBeInstanceOf(Date);
  });

  it("sends an edited PUBLISHED listing back through review on submit", async () => {
    h.prisma.gemstone.findFirst.mockResolvedValue({ id: "l1", status: "PUBLISHED", sellerId: "sp_1", publishedAt: new Date(), submittedAt: null });
    h.prisma.gemstone.updateMany.mockResolvedValue({ count: 1 });
    const result = await saveListingAction({}, listingForm({ intent: "submit" }, "l1"));
    expect(result).toEqual({ saved: "submit", values: undefined });
    expect(h.prisma.gemstone.updateMany.mock.calls[0]?.[0]).toMatchObject({
      where: { id: "l1", seller: { userId: "u_seller" } },
      data: { status: "PENDING_REVIEW" },
    });
  });

  it("saving an edited PUBLISHED listing as draft returns it to DRAFT", async () => {
    h.prisma.gemstone.findFirst.mockResolvedValue({ id: "l1", status: "PUBLISHED", sellerId: "sp_1", publishedAt: new Date(), submittedAt: null });
    h.prisma.gemstone.updateMany.mockResolvedValue({ count: 1 });
    await saveListingAction({}, listingForm({ intent: "draft" }, "l1"));
    expect(h.prisma.gemstone.updateMany.mock.calls[0]?.[0].data.status).toBe("DRAFT");
  });

  it("refuses to submit a listing already awaiting review", async () => {
    h.prisma.gemstone.findFirst.mockResolvedValue({ id: "l1", status: "PENDING_REVIEW", sellerId: "sp_1", publishedAt: null, submittedAt: null });
    const result = await saveListingAction({}, listingForm({ intent: "submit" }, "l1"));
    expect(result).toEqual({ formError: "This listing is already awaiting review." });
    expect(h.prisma.gemstone.updateMany).not.toHaveBeenCalled();
  });
});

describe("price parsing in the form action", () => {
  it("stores the price in minor units", async () => {
    h.prisma.gemstone.create.mockResolvedValue({ id: "l_new" });
    await expectRedirect(saveListingAction({}, listingForm({ price: "12,500.50" })));
    expect(h.prisma.gemstone.create.mock.calls[0]?.[0].data).toMatchObject({ priceMinor: BigInt(1250050), priceOnRequest: false });
  });

  it("stores price on request with a null price", async () => {
    h.prisma.gemstone.create.mockResolvedValue({ id: "l_new" });
    await expectRedirect(saveListingAction({}, listingForm({ priceMode: "ON_REQUEST", price: "" })));
    expect(h.prisma.gemstone.create.mock.calls[0]?.[0].data).toMatchObject({ priceMinor: null, priceOnRequest: true });
  });

  it("returns a field error for a bad price and writes nothing", async () => {
    const result = await saveListingAction({}, listingForm({ price: "12.345" }));
    expect(result).toMatchObject({ fieldErrors: { price: expect.any(String) } });
    expect(h.prisma.gemstone.create).not.toHaveBeenCalled();
  });

  it("rejects a category that does not exist", async () => {
    h.prisma.category.findUnique.mockResolvedValue(null);
    const result = await saveListingAction({}, listingForm());
    expect(result).toMatchObject({ fieldErrors: { categoryId: expect.any(String) } });
  });
});

describe("media limits", () => {
  it("refuses an image when the listing already has 10 images, and stores nothing", async () => {
    const jpeg = await sharp({ create: { width: 40, height: 40, channels: 3, background: { r: 1, g: 2, b: 3 } } }).jpeg().toBuffer();
    h.prisma.gemstone.findFirst.mockResolvedValue({ id: "l1", status: "DRAFT", sellerId: "sp_1", publishedAt: null, submittedAt: null });
    h.prisma.gemstoneMedia.findMany.mockResolvedValue(Array.from({ length: 10 }, () => ({ type: "IMAGE", isCover: false, sortOrder: 0 })));

    const fd = new FormData();
    fd.set("listingId", "l1");
    fd.append("media", new File([new Uint8Array(jpeg)], "photo.jpg", { type: "image/jpeg" }));
    const result = await uploadMediaAction({}, fd);

    expect(result).toEqual({ error: "A listing can have up to 10 images." });
    expect(storage.objects.size).toBe(0);
    expect(h.prisma.gemstoneMedia.createMany).not.toHaveBeenCalled();
  });

  it("rejects bytes that are not an image or video", async () => {
    h.prisma.gemstone.findFirst.mockResolvedValue({ id: "l1", status: "DRAFT", sellerId: "sp_1", publishedAt: null, submittedAt: null });
    h.prisma.gemstoneMedia.findMany.mockResolvedValue([]);
    const fd = new FormData();
    fd.set("listingId", "l1");
    fd.append("media", new File([new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])], "evil.jpg", { type: "image/jpeg" }));
    const result = await uploadMediaAction({}, fd);
    expect(result.error).toMatch(/^File 1: /);
    expect(storage.objects.size).toBe(0);
  });
});

describe("document type validation", () => {
  it("rejects an executable renamed to .pdf and creates no row", async () => {
    h.prisma.gemstone.findFirst.mockResolvedValue({ id: "l1", status: "DRAFT", sellerId: "sp_1", publishedAt: null, submittedAt: null });
    h.prisma.listingDocument.count.mockResolvedValue(0);
    const fd = new FormData();
    fd.set("listingId", "l1");
    fd.set("type", "CERTIFICATE");
    fd.set("title", "GIA report");
    fd.append("file", new File([new Uint8Array([0x4d, 0x5a, 0, 0, 0, 0, 0, 0])], "report.pdf", { type: "application/pdf" }));
    const result = await uploadDocumentAction({}, fd);
    expect(result).toEqual({ error: "Upload a PDF, JPEG or PNG file." });
    expect(h.prisma.listingDocument.create).not.toHaveBeenCalled();
    expect(storage.objects.size).toBe(0);
  });

  it("stores a valid PDF privately as PENDING and not public", async () => {
    h.prisma.gemstone.findFirst.mockResolvedValue({ id: "l1", status: "DRAFT", sellerId: "sp_1", publishedAt: null, submittedAt: null });
    h.prisma.listingDocument.count.mockResolvedValue(0);
    h.prisma.listingDocument.create.mockResolvedValue({ id: "d1" });
    const fd = new FormData();
    fd.set("listingId", "l1");
    fd.set("type", "CERTIFICATE");
    fd.set("title", "GIA report");
    fd.append("file", new File([new Uint8Array(Buffer.from("%PDF-1.7\n1 0 obj"))], "../../x.pdf", { type: "application/pdf" }));
    const result = await uploadDocumentAction({}, fd);
    expect(result).toMatchObject({ message: expect.any(String) });
    const data = h.prisma.listingDocument.create.mock.calls[0]?.[0].data;
    expect(data).toMatchObject({ isPublic: false, verificationStatus: "PENDING", fileName: "x.pdf", mimeType: "application/pdf" });
    expect(data.fileKey).toMatch(/^listing-docs\/l1\/[0-9a-f]{32}\.pdf$/);
  });
});
