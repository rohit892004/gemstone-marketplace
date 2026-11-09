import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

/** Log written by the production server (console email provider prints messages here). */
const LOG = path.join(__dirname, ".server.log");

export function serverLog(): string {
  return existsSync(LOG) ? readFileSync(LOG, "utf8") : "";
}

/**
 * Finds the link for a message sent to `to`. Waits (polls) because email is printed after the
 * server action responds. Returns the token from `/<path>?token=...`.
 */
export async function tokenSentTo(to: string, pathPart: "verify-email" | "reset-password", timeoutMs = 20_000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  const pattern = new RegExp(`to=${escapeRe(to)}[\\s\\S]*?/${pathPart}\\?token=([A-Za-z0-9_-]+)`, "g");
  while (Date.now() < deadline) {
    const matches = [...serverLog().matchAll(pattern)];
    if (matches.length > 0) return matches[matches.length - 1][1];
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`No ${pathPart} email found for ${to} within ${timeoutMs}ms`);
}

function escapeRe(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** A small valid JPEG generated in memory (no EXIF). */
export async function sampleJpeg(color = { r: 20, g: 90, b: 75 }): Promise<Buffer> {
  return sharp({ create: { width: 900, height: 700, channels: 3, background: color } }).jpeg().toBuffer();
}

/** A minimal PDF byte string. Enough for the magic-byte check. */
export function samplePdf(): Buffer {
  return Buffer.from("%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\n%%EOF\n");
}
