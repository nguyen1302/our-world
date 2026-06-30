import { describe, it, expect } from "vitest";
import sharp from "sharp";
import exifr from "exifr";
import { makeThumbnail } from "@/lib/thumbnail";

describe("makeThumbnail", () => {
  it("outputs webp within max size and strips metadata", async () => {
    const src = await sharp({
      create: { width: 3000, height: 2000, channels: 3, background: { r: 200, g: 100, b: 50 } },
    })
      .withMetadata({ orientation: 6 })
      .jpeg()
      .toBuffer();

    const thumb = await makeThumbnail(src, 1200);
    const meta = await sharp(thumb).metadata();

    expect(meta.format).toBe("webp");
    expect(meta.width).toBeLessThanOrEqual(1200);
    expect(meta.height).toBeLessThanOrEqual(1200);

    const exif = await exifr.parse(thumb).catch(() => null);
    expect(exif).toBeFalsy(); // no EXIF carried over
  });
});
