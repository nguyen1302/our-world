import sharp from "sharp";

/** Detect HEIC/HEIF by the ISO-BMFF `ftyp` brand. */
export function isHeic(buf: Buffer): boolean {
  if (buf.length < 12) return false;
  if (buf.subarray(4, 8).toString("latin1") !== "ftyp") return false;
  const brand = buf.subarray(8, 12).toString("latin1").toLowerCase();
  return /heic|heix|heif|mif1|msf1|hevc|hevx/.test(brand);
}

/**
 * sharp's prebuilt binaries can't decode HEIC (libheif not bundled). iPhone
 * photos are HEIC, so convert them to JPEG first (pure-JS, no system libs),
 * then sharp handles the rest.
 */
async function toDecodable(input: Buffer): Promise<Buffer> {
  if (!isHeic(input)) return input;
  const convert = (await import("heic-convert")).default;
  const out = await convert({ buffer: input, format: "JPEG", quality: 0.92 });
  return Buffer.from(out);
}

/**
 * Resize to fit within maxPx, output webp. Applies EXIF orientation then
 * strips ALL metadata (sharp drops metadata unless withMetadata is called),
 * so the thumbnail carries no GPS. Handles HEIC input.
 */
export async function makeThumbnail(input: Buffer, maxPx = 1200): Promise<Buffer> {
  const buf = await toDecodable(input);
  return sharp(buf)
    .rotate() // bake in EXIF orientation before metadata is dropped
    .resize({ width: maxPx, height: maxPx, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();
}
