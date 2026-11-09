import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetEnvCacheForTests } from "@/lib/config/env";
import { validateUpload } from "@/lib/storage/upload-validation";
import { assertValidStorageKey } from "@/lib/storage/storage";
import { canAddDocument, canSellerDeleteDocument, MAX_LISTING_DOCUMENTS } from "./documents";
import { listingDocumentKey } from "./keys";

const PDF = Buffer.concat([Buffer.from("%PDF-1.7\n"), Buffer.alloc(64)]);
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64)]);
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64)]);
const EXE = Buffer.concat([Buffer.from("MZ"), Buffer.alloc(64)]);

beforeEach(() => {
  process.env.DATABASE_URL = "postgresql://u:p@localhost:5432/db";
  process.env.UPLOAD_MAX_MB = "1";
  resetEnvCacheForTests();
});

afterEach(() => {
  delete process.env.UPLOAD_MAX_MB;
  resetEnvCacheForTests();
});

describe("listing document type validation (reuses validateUpload)", () => {
  it("accepts PDF, JPEG and PNG by magic bytes", () => {
    expect(validateUpload(PDF)).toMatchObject({ ok: true, ext: "pdf" });
    expect(validateUpload(JPEG)).toMatchObject({ ok: true, ext: "jpg" });
    expect(validateUpload(PNG)).toMatchObject({ ok: true, ext: "png" });
  });

  it("rejects other types even when the claimed name says PDF", () => {
    expect(validateUpload(EXE)).toEqual({ ok: false, reason: "unsupported_type" });
  });

  it("rejects files above UPLOAD_MAX_MB", () => {
    const big = Buffer.concat([Buffer.from("%PDF-1.7\n"), Buffer.alloc(2 * 1024 * 1024)]);
    expect(validateUpload(big)).toEqual({ ok: false, reason: "too_large" });
  });

  it("produces storage keys that pass the storage key check", () => {
    const key = listingDocumentKey("cmabc123", "pdf");
    expect(key).toMatch(/^listing-docs\/cmabc123\/[0-9a-f]{32}\.pdf$/);
    expect(() => assertValidStorageKey(key)).not.toThrow();
  });
});

describe("document limits and deletion", () => {
  it("allows up to 10 documents per listing", () => {
    expect(MAX_LISTING_DOCUMENTS).toBe(10);
    expect(canAddDocument(9)).toBe(true);
    expect(canAddDocument(10)).toBe(false);
  });

  it("lets a seller delete pending and rejected documents", () => {
    expect(canSellerDeleteDocument({ verificationStatus: "PENDING" })).toBe(true);
    expect(canSellerDeleteDocument({ verificationStatus: "REJECTED" })).toBe(true);
  });

  it("never lets a seller delete a verified document", () => {
    expect(canSellerDeleteDocument({ verificationStatus: "VERIFIED" })).toBe(false);
  });
});
