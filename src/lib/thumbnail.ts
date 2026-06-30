import sharp from "sharp";

/**
 * Resize to fit within maxPx, output webp. Applies EXIF orientation then
 * strips ALL metadata (sharp drops metadata unless withMetadata is called),
 * so the thumbnail carries no GPS.
 */
export async function makeThumbnail(input: Buffer, maxPx = 1200): Promise<Buffer> {
  return sharp(input)
    .rotate() // bake in EXIF orientation before metadata is dropped
    .resize({ width: maxPx, height: maxPx, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();
}
