import { eq } from "drizzle-orm";
import { db } from "@/db";
import { photos } from "@/db/schema";
import { getStorage, thumbKey } from "@/lib/storage";
import { readExif } from "@/lib/exif";
import { makeThumbnail } from "@/lib/thumbnail";
import { reverseGeocode } from "@/lib/geocode";
import { assignPhotoToMemory } from "@/lib/cluster";

export async function processPhoto(photoId: string): Promise<void> {
  const rows = await db.select().from(photos).where(eq(photos.id, photoId)).limit(1);
  const photo = rows[0];
  if (!photo) throw new Error(`photo not found: ${photoId}`);

  const storage = getStorage();
  const original = await storage.getObject(photo.s3KeyOriginal);
  const exif = await readExif(original);

  // No GPS -> cannot place on map. Keep it but flag for review.
  if (exif.lat === null || exif.lng === null) {
    await db
      .update(photos)
      .set({
        status: "needs_review",
        takenAt: exif.takenAt,
        width: exif.width,
        height: exif.height,
        exifJson: exif as any,
      })
      .where(eq(photos.id, photoId));
    return;
  }

  const geo = await reverseGeocode(exif.lat, exif.lng);

  const thumb = await makeThumbnail(original);
  const tKey = thumbKey(photo.spaceId, photoId);
  await storage.putObject(tKey, thumb, "image/webp");

  const takenAt = exif.takenAt ?? photo.createdAt;

  await db
    .update(photos)
    .set({
      takenAt,
      lat: exif.lat,
      lng: exif.lng,
      width: exif.width,
      height: exif.height,
      s3KeyThumb: tKey,
      status: "processed",
      exifJson: exif as any,
    })
    .where(eq(photos.id, photoId));

  await assignPhotoToMemory(
    { id: photoId, spaceId: photo.spaceId, lat: exif.lat, lng: exif.lng, takenAt },
    geo,
  );
}
