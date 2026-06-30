import { describe, it, expect } from "vitest";
import { parseExifData, readExif } from "@/lib/exif";
import sharp from "sharp";

describe("parseExifData", () => {
  it("extracts gps and date", () => {
    const r = parseExifData(
      { latitude: 11.94, longitude: 108.45, DateTimeOriginal: new Date("2026-06-30T02:00:00Z") },
      { width: 4000, height: 3000 },
    );
    expect(r.lat).toBeCloseTo(11.94);
    expect(r.lng).toBeCloseTo(108.45);
    expect(r.takenAt?.toISOString()).toBe("2026-06-30T02:00:00.000Z");
    expect(r.width).toBe(4000);
  });

  it("returns nulls when no gps", () => {
    const r = parseExifData({}, {});
    expect(r.lat).toBeNull();
    expect(r.lng).toBeNull();
    expect(r.takenAt).toBeNull();
  });
});

describe("readExif integration (no-gps image)", () => {
  it("reads dimensions, gps null", async () => {
    const png = await sharp({
      create: { width: 320, height: 240, channels: 3, background: { r: 10, g: 20, b: 30 } },
    })
      .jpeg()
      .toBuffer();
    const r = await readExif(png);
    expect(r.width).toBe(320);
    expect(r.height).toBe(240);
    expect(r.lat).toBeNull();
  });
});
