import { describe, expect, it } from "vitest";
import { MEDIA_LIMITS } from "@/lib/listings/schema";
import {
  applyCover,
  checkMediaBatch,
  coverPromotionAfterRemoval,
  moveItem,
  sortMedia,
  sortOrderAssignments,
  type MediaItem,
} from "./media-rules";

const MB = 1024 * 1024;

describe("checkMediaBatch", () => {
  it("accepts a batch within the limits", () => {
    expect(checkMediaBatch({ images: 2, videos: 0 }, [{ kind: "IMAGE", sizeBytes: 1 }])).toEqual({ ok: true });
  });

  it("counts existing images toward the total", () => {
    const existing = { images: MEDIA_LIMITS.maxImages, videos: 0 };
    expect(checkMediaBatch(existing, [{ kind: "IMAGE", sizeBytes: 1 }])).toEqual({ ok: false, reason: "too_many_images" });
  });

  it("allows filling exactly up to the image limit", () => {
    const existing = { images: MEDIA_LIMITS.maxImages - 2, videos: 0 };
    expect(
      checkMediaBatch(existing, [
        { kind: "IMAGE", sizeBytes: 1 },
        { kind: "IMAGE", sizeBytes: 1 },
      ]),
    ).toEqual({ ok: true });
  });

  it("enforces the video limit separately from images", () => {
    expect(checkMediaBatch({ images: 0, videos: MEDIA_LIMITS.maxVideos }, [{ kind: "VIDEO", sizeBytes: 1 }])).toEqual({
      ok: false,
      reason: "too_many_videos",
    });
  });

  it("rejects an oversized image and an oversized video", () => {
    expect(checkMediaBatch({ images: 0, videos: 0 }, [{ kind: "IMAGE", sizeBytes: MEDIA_LIMITS.maxImageBytes + 1 }])).toEqual({
      ok: false,
      reason: "image_too_large",
    });
    expect(checkMediaBatch({ images: 0, videos: 0 }, [{ kind: "VIDEO", sizeBytes: MEDIA_LIMITS.maxVideoBytes + 1 }])).toEqual({
      ok: false,
      reason: "video_too_large",
    });
  });

  it("accepts sizes exactly at the limit (15 MB image, 60 MB video)", () => {
    expect(checkMediaBatch({ images: 0, videos: 0 }, [{ kind: "IMAGE", sizeBytes: 15 * MB }])).toEqual({ ok: true });
    expect(checkMediaBatch({ images: 0, videos: 0 }, [{ kind: "VIDEO", sizeBytes: 60 * MB }])).toEqual({ ok: true });
  });

  it("rejects an empty batch", () => {
    expect(checkMediaBatch({ images: 0, videos: 0 }, [])).toEqual({ ok: false, reason: "empty_batch" });
  });
});

const item = (id: string, sortOrder: number, extra: Partial<MediaItem> = {}): MediaItem => ({
  id,
  type: "IMAGE",
  sortOrder,
  isCover: false,
  ...extra,
});

describe("applyCover", () => {
  it("makes the target the only cover", () => {
    const items = [item("a", 0, { isCover: true }), item("b", 1), item("c", 2)];
    expect(applyCover(items, "c")).toEqual([
      { id: "a", isCover: false },
      { id: "b", isCover: false },
      { id: "c", isCover: true },
    ]);
  });

  it("never sets a video as cover", () => {
    const items = [item("a", 0, { isCover: true }), item("v", 1, { type: "VIDEO" })];
    expect(applyCover(items, "v")).toBeNull();
  });

  it("returns null for an id that is not on this listing", () => {
    expect(applyCover([item("a", 0, { isCover: true })], "zzz")).toBeNull();
  });

  it("always leaves exactly one cover among images", () => {
    const items = [item("a", 0, { isCover: true }), item("b", 1)];
    for (const target of ["a", "b", "a"]) {
      const plan = applyCover(items, target);
      expect(plan?.filter((p) => p.isCover)).toHaveLength(1);
    }
  });
});

describe("coverPromotionAfterRemoval", () => {
  it("promotes the lowest sortOrder image when the cover is removed", () => {
    const items = [item("a", 0), item("b", 1, { isCover: true }), item("c", 2), item("d", 3)];
    expect(coverPromotionAfterRemoval(items, "b")).toBe("a");
  });

  it("does nothing when a non-cover item is removed", () => {
    const items = [item("a", 0, { isCover: true }), item("b", 1)];
    expect(coverPromotionAfterRemoval(items, "b")).toBeNull();
  });

  it("returns null when no image is left to promote", () => {
    const items = [item("a", 0, { isCover: true }), item("v", 1, { type: "VIDEO" })];
    expect(coverPromotionAfterRemoval(items, "a")).toBeNull();
  });
});

describe("sort and reorder", () => {
  it("sorts by sortOrder with a stable id tie-break", () => {
    const sorted = sortMedia([item("b", 1), item("c", 0), item("a", 1)]).map((m) => m.id);
    expect(sorted).toEqual(["c", "a", "b"]);
  });

  it("moves an item up and down", () => {
    expect(moveItem(["a", "b", "c"], "b", "up")).toEqual(["b", "a", "c"]);
    expect(moveItem(["a", "b", "c"], "b", "down")).toEqual(["a", "c", "b"]);
  });

  it("refuses to move past either end or for an unknown id", () => {
    expect(moveItem(["a", "b"], "a", "up")).toBeNull();
    expect(moveItem(["a", "b"], "b", "down")).toBeNull();
    expect(moveItem(["a", "b"], "zzz", "up")).toBeNull();
  });

  it("does not mutate the input order", () => {
    const order = ["a", "b", "c"];
    moveItem(order, "c", "up");
    expect(order).toEqual(["a", "b", "c"]);
  });

  it("assigns sort orders 0..n-1 in the new order", () => {
    expect(sortOrderAssignments(["c", "a"])).toEqual([
      { id: "c", sortOrder: 0 },
      { id: "a", sortOrder: 1 },
    ]);
  });
});
