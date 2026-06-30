import exifr from "exifr";
import sharp from "sharp";

export interface ExifData {
  takenAt: Date | null;
  lat: number | null;
  lng: number | null;
  width: number | null;
  height: number | null;
}

/** Normalize a raw exifr result into our fields. Pure + unit-testable. */
export function parseExifData(
  raw: Record<string, unknown> | null | undefined,
  dims?: { width?: number | null; height?: number | null },
): ExifData {
  const lat = numOrNull(raw?.latitude);
  const lng = numOrNull(raw?.longitude);
  const takenAt = dateOrNull(
    raw?.DateTimeOriginal ?? raw?.CreateDate ?? raw?.DateTimeDigitized ?? raw?.ModifyDate,
  );
  return {
    takenAt,
    lat,
    lng,
    width: dims?.width ?? null,
    height: dims?.height ?? null,
  };
}

function numOrNull(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function dateOrNull(v: unknown): Date | null {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v;
  if (typeof v === "string") {
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
}

/** Read EXIF (GPS + time) and pixel dimensions from an image buffer. */
export async function readExif(buf: Buffer): Promise<ExifData> {
  let raw: Record<string, unknown> | null = null;
  try {
    raw = (await exifr.parse(buf, { gps: true })) as Record<string, unknown> | null;
  } catch {
    raw = null;
  }
  let dims: { width?: number; height?: number } = {};
  try {
    const meta = await sharp(buf).metadata();
    dims = { width: meta.width, height: meta.height };
  } catch {
    dims = {};
  }
  return parseExifData(raw, dims);
}
