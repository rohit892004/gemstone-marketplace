import { MEDIA_LIMITS } from "@/lib/listings/schema";

/**
 * Pure rules for listing media: count and size limits, cover uniqueness, and ordering.
 * No database or storage access here, so every rule can be unit tested.
 */

export type MediaKind = "IMAGE" | "VIDEO";

export interface MediaItem {
  id: string;
  type: MediaKind;
  sortOrder: number;
  isCover: boolean;
}

export interface IncomingFile {
  kind: MediaKind;
  sizeBytes: number;
}

export type MediaBatchCheck =
  | { ok: true }
  | { ok: false; reason: "too_many_images" | "too_many_videos" | "image_too_large" | "video_too_large" | "empty_batch" };

/**
 * Checks an upload batch against the limits, counting existing media.
 * Sizes are the browser-claimed sizes: this check runs BEFORE processing so oversized files
 * are never read into memory. processMedia re-checks the real bytes.
 */
export function checkMediaBatch(existing: { images: number; videos: number }, incoming: IncomingFile[]): MediaBatchCheck {
  if (incoming.length === 0) return { ok: false, reason: "empty_batch" };
  const newImages = incoming.filter((f) => f.kind === "IMAGE").length;
  const newVideos = incoming.length - newImages;
  if (existing.images + newImages > MEDIA_LIMITS.maxImages) return { ok: false, reason: "too_many_images" };
  if (existing.videos + newVideos > MEDIA_LIMITS.maxVideos) return { ok: false, reason: "too_many_videos" };
  for (const file of incoming) {
    if (file.kind === "IMAGE" && file.sizeBytes > MEDIA_LIMITS.maxImageBytes) return { ok: false, reason: "image_too_large" };
    if (file.kind === "VIDEO" && file.sizeBytes > MEDIA_LIMITS.maxVideoBytes) return { ok: false, reason: "video_too_large" };
  }
  return { ok: true };
}

/** Items sorted by sortOrder (ties broken by id so the order is stable). */
export function sortMedia<T extends { id: string; sortOrder: number }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
}

/**
 * Cover uniqueness: exactly one image is the cover while any image exists.
 * Returns the { id, isCover } values to write for the whole listing so the caller can apply
 * them in one transaction, or null when the target is not an image on this listing.
 */
export function applyCover(items: readonly MediaItem[], targetId: string): { id: string; isCover: boolean }[] | null {
  const target = items.find((m) => m.id === targetId);
  if (!target || target.type !== "IMAGE") return null;
  return items.map((m) => ({ id: m.id, isCover: m.id === targetId }));
}

/**
 * After removing an item, returns the image id that must become the cover, or null when no
 * cover change is needed (the removed item was not the cover, or nothing is left to promote).
 */
export function coverPromotionAfterRemoval(items: readonly MediaItem[], removedId: string): string | null {
  const removed = items.find((m) => m.id === removedId);
  if (!removed || !removed.isCover) return null;
  const remainingImages = items.filter((m) => m.id !== removedId && m.type === "IMAGE");
  return sortMedia(remainingImages)[0]?.id ?? null;
}

/** Moves one item up or down. Returns the new id order, or null when the move is not possible. */
export function moveItem(orderedIds: readonly string[], id: string, direction: "up" | "down"): string[] | null {
  const index = orderedIds.indexOf(id);
  if (index === -1) return null;
  const target = direction === "up" ? index - 1 : index + 1;
  if (target < 0 || target >= orderedIds.length) return null;
  const next = [...orderedIds];
  const a = next[index];
  const b = next[target];
  if (a === undefined || b === undefined) return null;
  next[index] = b;
  next[target] = a;
  return next;
}

/** Sort order values for a new id order: 0..n-1. */
export function sortOrderAssignments(orderedIds: readonly string[]): { id: string; sortOrder: number }[] {
  return orderedIds.map((id, sortOrder) => ({ id, sortOrder }));
}
