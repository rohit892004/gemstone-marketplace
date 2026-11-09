import sharp from "sharp";
import { MEDIA_LIMITS } from "@/lib/listings/schema";

/**
 * Listing media pipeline.
 *
 * Images: checked by magic bytes, decoded by sharp (corrupt or non-image files fail),
 * rotated per EXIF orientation, then re-encoded to WebP. Re-encoding drops EXIF, GPS and
 * other metadata. A 480px thumbnail is produced for lazy-loaded grids.
 *
 * Videos: checked by magic bytes and size only. They are stored as-is, so container
 * metadata (including any GPS tags) is NOT stripped yet. Tracked as a known limitation
 * until an ffmpeg step is available.
 *
 * Nothing here trusts the browser MIME type or the file name.
 */

export type MediaKind = "IMAGE" | "VIDEO";

export interface ProcessedImage {
  kind: "IMAGE";
  main: { data: Buffer; mimeType: "image/webp"; width: number; height: number };
  thumb: { data: Buffer; mimeType: "image/webp"; width: number; height: number };
  sizeBytes: number;
}

export interface ProcessedVideo {
  kind: "VIDEO";
  data: Buffer;
  mimeType: "video/mp4" | "video/webm";
  ext: "mp4" | "webm";
  sizeBytes: number;
}

export type ProcessedMedia = ProcessedImage | ProcessedVideo;

export type MediaError = "empty" | "too_large" | "unsupported_type" | "undecodable";

export const MEDIA_ERROR_TEXT: Record<MediaError, string> = {
  empty: "The file is empty.",
  too_large: "The file is too large for this type.",
  unsupported_type: "Upload a JPEG, PNG, WebP image or an MP4/WebM video.",
  undecodable: "The image could not be read. Try another file.",
};

const MAX_PIXELS = 40_000_000;

/** ISO-BMFF major brands used by HEIC/HEIF and AVIF still images. */
const HEIF_BRANDS = new Set(["heic", "heix", "hevc", "heim", "heis", "hevm", "hevs", "mif1", "msf1", "avif", "avis"]);

function sniff(bytes: Buffer): { kind: MediaKind; ext: string } | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { kind: "IMAGE", ext: "jpg" };
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { kind: "IMAGE", ext: "png" };
  }
  if (bytes.length >= 12 && bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP") {
    return { kind: "IMAGE", ext: "webp" };
  }
  if (bytes.length >= 12 && bytes.subarray(4, 8).toString("ascii") === "ftyp") {
    // HEIF/AVIF photos share the ISO-BMFF container. They are refused rather than stored as
    // "video", because they would bypass the EXIF/GPS-stripping re-encode.
    const brand = bytes.subarray(8, 12).toString("ascii");
    if (HEIF_BRANDS.has(brand)) return null;
    return { kind: "VIDEO", ext: "mp4" };
  }
  if (bytes.length >= 4 && bytes.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))) return { kind: "VIDEO", ext: "webm" };
  return null;
}

export async function processMedia(
  bytes: Buffer,
): Promise<{ ok: true; media: ProcessedMedia } | { ok: false; reason: MediaError }> {
  if (bytes.length === 0) return { ok: false, reason: "empty" };
  const sniffed = sniff(bytes);
  if (!sniffed) return { ok: false, reason: "unsupported_type" };

  if (sniffed.kind === "VIDEO") {
    if (bytes.length > MEDIA_LIMITS.maxVideoBytes) return { ok: false, reason: "too_large" };
    const ext = sniffed.ext as "mp4" | "webm";
    return {
      ok: true,
      media: { kind: "VIDEO", data: bytes, mimeType: ext === "mp4" ? "video/mp4" : "video/webm", ext, sizeBytes: bytes.length },
    };
  }

  if (bytes.length > MEDIA_LIMITS.maxImageBytes) return { ok: false, reason: "too_large" };
  try {
    const base = sharp(bytes, { limitInputPixels: MAX_PIXELS }).rotate();
    const main = await base.clone().resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toBuffer({ resolveWithObject: true });
    const thumb = await base.clone().resize({ width: 480, height: 480, fit: "inside", withoutEnlargement: true }).webp({ quality: 75 }).toBuffer({ resolveWithObject: true });
    return {
      ok: true,
      media: {
        kind: "IMAGE",
        main: { data: main.data, mimeType: "image/webp", width: main.info.width, height: main.info.height },
        thumb: { data: thumb.data, mimeType: "image/webp", width: thumb.info.width, height: thumb.info.height },
        sizeBytes: main.data.length,
      },
    };
  } catch {
    return { ok: false, reason: "undecodable" };
  }
}
