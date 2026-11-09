import { randomBytes } from "node:crypto";
import { assertValidStorageKey } from "@/lib/storage/storage";

/** Random hex for file names. The original upload name is never part of a storage key. */
export function randomHex(bytes = 16): string {
  return randomBytes(bytes).toString("hex");
}

/** Slug: title words + short random suffix. Lowercase, URL-safe. */
export function generateListingSlug(title: string, suffix: string = randomHex(3)): string {
  const base = title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
  return `${base || "gemstone"}-${suffix}`;
}

export function listingMediaKey(listingId: string, ext: string, variant?: "thumb"): string {
  const key = `listings/${listingId}/media/${randomHex()}${variant ? `-${variant}` : ""}.${ext}`;
  assertValidStorageKey(key);
  return key;
}

export function listingDocumentKey(listingId: string, ext: string): string {
  const key = `listing-docs/${listingId}/${randomHex()}.${ext}`;
  assertValidStorageKey(key);
  return key;
}

export function portfolioImageKey(sellerId: string, kind: "logo" | "banner"): string {
  const key = `portfolio/${sellerId}/${kind}-${randomHex()}.webp`;
  assertValidStorageKey(key);
  return key;
}
