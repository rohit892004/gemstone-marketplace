import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetEnvCacheForTests } from "@/lib/config/env";
import { validateUpload } from "./upload-validation";
import { assertValidStorageKey } from "./storage";

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

describe("validateUpload", () => {
  it("accepts PDF, JPEG and PNG by magic bytes", () => {
    expect(validateUpload(PDF)).toMatchObject({ ok: true, mimeType: "application/pdf", ext: "pdf" });
    expect(validateUpload(JPEG)).toMatchObject({ ok: true, mimeType: "image/jpeg", ext: "jpg" });
    expect(validateUpload(PNG)).toMatchObject({ ok: true, mimeType: "image/png", ext: "png" });
  });

  it("rejects other content even if it is disguised as a PDF by name", () => {
    // The caller never passes the filename here, so only the bytes count.
    expect(validateUpload(EXE)).toEqual({ ok: false, reason: "unsupported_type" });
  });

  it("rejects empty files", () => {
    expect(validateUpload(Buffer.alloc(0))).toEqual({ ok: false, reason: "empty" });
  });

  it("rejects files over UPLOAD_MAX_MB", () => {
    const big = Buffer.concat([Buffer.from("%PDF-"), Buffer.alloc(1024 * 1024)]);
    expect(validateUpload(big)).toEqual({ ok: false, reason: "too_large" });
  });
});

describe("assertValidStorageKey", () => {
  it("accepts generated keys", () => {
    expect(() => assertValidStorageKey("sellers/cabc123/doc-1.pdf")).not.toThrow();
  });

  it("rejects traversal, absolute paths and backslashes", () => {
    expect(() => assertValidStorageKey("../etc/passwd.pdf")).toThrow();
    expect(() => assertValidStorageKey("sellers/../../x.pdf")).toThrow();
    expect(() => assertValidStorageKey("/abs/file.pdf")).toThrow();
    expect(() => assertValidStorageKey("sellers\\x.pdf")).toThrow();
  });
});
