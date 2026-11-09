import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { processMedia } from "./pipeline";

async function jpegWithGps(): Promise<Buffer> {
  // Build a JPEG that carries EXIF including a GPS-like tag, using sharp's own metadata writer.
  return sharp({ create: { width: 800, height: 600, channels: 3, background: { r: 20, g: 90, b: 75 } } })
    .jpeg()
    .withExif({ IFD0: { Make: "TestCam", Copyright: "private" }, IFD3: { GPSLatitudeRef: "N", GPSLatitude: "26/1 55/1 0/1" } })
    .toBuffer();
}

describe("processMedia", () => {
  it("re-encodes images to WebP with EXIF and GPS removed", async () => {
    const input = await jpegWithGps();
    const before = await sharp(input).metadata();
    expect(before.exif).toBeDefined();

    const result = await processMedia(input);
    expect(result.ok).toBe(true);
    if (!result.ok || result.media.kind !== "IMAGE") throw new Error("expected image");

    const out = await sharp(result.media.main.data).metadata();
    expect(out.format).toBe("webp");
    expect(out.exif).toBeUndefined();
    expect(result.media.main.mimeType).toBe("image/webp");
  });

  it("produces a smaller thumbnail and caps the main size", async () => {
    const big = await sharp({ create: { width: 3000, height: 2000, channels: 3, background: { r: 1, g: 2, b: 3 } } }).jpeg().toBuffer();
    const result = await processMedia(big);
    if (!result.ok || result.media.kind !== "IMAGE") throw new Error("expected image");
    expect(result.media.main.width).toBeLessThanOrEqual(1600);
    expect(result.media.thumb.width).toBeLessThanOrEqual(480);
  });

  it("rejects a file that is not an image even when it starts with a JPEG signature", async () => {
    const fake = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from("not really a picture at all")]);
    const result = await processMedia(fake);
    expect(result).toEqual({ ok: false, reason: "undecodable" });
  });

  it("rejects unknown content and empty files", async () => {
    expect(await processMedia(Buffer.from("MZ....exe"))).toEqual({ ok: false, reason: "unsupported_type" });
    expect(await processMedia(Buffer.alloc(0))).toEqual({ ok: false, reason: "empty" });
  });

  it("accepts an MP4 signature as video without re-encoding", async () => {
    const mp4 = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from("ftypisom"), Buffer.alloc(64)]);
    const result = await processMedia(mp4);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.media.kind).toBe("VIDEO");
  });
});
