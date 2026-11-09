import { getEnv } from "@/lib/config/env";

/**
 * Validates an uploaded file by size and by its leading bytes (magic numbers).
 * The browser-supplied MIME type and file extension are NOT trusted.
 */

export type AllowedMime = "application/pdf" | "image/jpeg" | "image/png";

const SIGNATURES: { mime: AllowedMime; ext: string; test: (b: Buffer) => boolean }[] = [
  {
    mime: "application/pdf",
    ext: "pdf",
    test: (b) => b.length >= 5 && b.subarray(0, 5).toString("ascii") === "%PDF-",
  },
  {
    mime: "image/jpeg",
    ext: "jpg",
    test: (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    mime: "image/png",
    ext: "png",
    test: (b) =>
      b.length >= 8 &&
      b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
];

export type UploadCheck =
  | { ok: true; mimeType: AllowedMime; ext: string; sizeBytes: number }
  | { ok: false; reason: "empty" | "too_large" | "unsupported_type" };

export function validateUpload(bytes: Buffer): UploadCheck {
  if (bytes.length === 0) return { ok: false, reason: "empty" };
  const maxBytes = getEnv().UPLOAD_MAX_MB * 1024 * 1024;
  if (bytes.length > maxBytes) return { ok: false, reason: "too_large" };
  const match = SIGNATURES.find((s) => s.test(bytes));
  if (!match) return { ok: false, reason: "unsupported_type" };
  return { ok: true, mimeType: match.mime, ext: match.ext, sizeBytes: bytes.length };
}

/** Human-readable reason for form errors. */
export function uploadErrorMessage(reason: Extract<UploadCheck, { ok: false }>["reason"]): string {
  switch (reason) {
    case "empty":
      return "The file is empty.";
    case "too_large":
      return `Files must be ${getEnv().UPLOAD_MAX_MB} MB or smaller.`;
    case "unsupported_type":
      return "Upload a PDF, JPEG or PNG file.";
  }
}
