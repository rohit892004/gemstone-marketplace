/**
 * Response helpers for the admin document download. Kept out of the route file,
 * because Next route modules may only export HTTP handlers.
 */

const MIME_PATTERN = /^[a-z0-9.+-]+\/[a-z0-9.+-]+$/i;

/** ASCII-only, no quotes, slashes or control characters. Safe inside a quoted Content-Disposition value. */
export function safeDownloadName(fileName: string): string {
  const cleaned = fileName
    .replace(/[^A-Za-z0-9._ -]+/g, "_")
    .replace(/^[. _-]+/, "")
    .slice(0, 120)
    .trim();
  return cleaned || "document";
}

/** Only well-formed type/subtype values reach the header; anything else is served as opaque bytes. */
export function safeContentType(mimeType: string): string {
  return MIME_PATTERN.test(mimeType) ? mimeType : "application/octet-stream";
}

export function documentResponseHeaders(doc: { mimeType: string; fileName: string }, byteLength: number): Headers {
  return new Headers({
    "Content-Type": safeContentType(doc.mimeType),
    "Content-Disposition": `attachment; filename="${safeDownloadName(doc.fileName)}"`,
    "Content-Length": String(byteLength),
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  });
}
