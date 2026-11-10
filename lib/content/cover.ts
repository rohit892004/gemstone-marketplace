/**
 * Cover image keys. Covers are stored as content/<articleId>/cover-<random>.<ext> through StorageProvider.
 * The media route serves a key only when it matches this shape AND an article row points at it.
 */

export const COVER_EXTENSIONS = ["jpg", "png"] as const;
export type CoverExtension = (typeof COVER_EXTENSIONS)[number];

const COVER_KEY = /^content\/[a-z0-9_-]{1,64}\/cover-[a-f0-9]{16,32}\.(jpg|png)$/;

export function isCoverKey(key: string): boolean {
  return COVER_KEY.test(key) && !key.includes("..");
}

/** Builds a key. `randomHex` must be lowercase hex (e.g. from randomBytes(8).toString("hex")). */
export function buildCoverKey(articleId: string, ext: CoverExtension, randomHex: string): string {
  const key = `content/${articleId}/cover-${randomHex}.${ext}`;
  if (!isCoverKey(key)) throw new Error("Invalid cover key");
  return key;
}

export function coverContentType(key: string): "image/jpeg" | "image/png" | null {
  if (!isCoverKey(key)) return null;
  return key.endsWith(".png") ? "image/png" : "image/jpeg";
}

/** Public URL for a cover, served by app/content-media. */
export function coverUrl(key: string): string {
  return `/content-media/${key}`;
}

/** Maps a sniffed upload type to a cover extension. PDF is never a cover. */
export function coverExtensionFor(mimeType: string): CoverExtension | null {
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/png") return "png";
  return null;
}
