import { eq } from "drizzle-orm";
import { db } from "@/db";
import { photos } from "@/db/schema";
import { getStorage, thumbKey } from "@/lib/storage";
import { readExif } from "@/lib/exif";
import { makeThumbnail } from "@/lib/thumbnail";
import { reverseGeocode } from "@/lib/geocode";
import { assignPhotoToMemory, recomputeMemoryAfterPhotoChange, recomputeTrip } from "@/lib/cluster";
import { memories } from "@/db/schema";

export async function processPhoto(photoId: string, fallbackMemoryId?: string): Promise<void> {
  const rows = await db.select().from(photos).where(eq(photos.id, photoId)).limit(1);
  const photo = rows[0];
  if (!photo) throw new Error(`photo not found: ${photoId}`);

  const storage = getStorage();
  const original = await storage.getObject(photo.s3KeyOriginal);
  const exif = await readExif(original);

  // Always create a thumbnail (also for no-GPS photos, so they can be shown
  // in the "unplaced" list and placed on the map manually). Resilient: if the
  // format can't be decoded (rare HEIC edge case), keep going without a thumb.
  let tKey: string | null = null;
  try {
    const thumb = await makeThumbnail(original);
    tKey = thumbKey(photo.spaceId, photoId);
    await storage.putObject(tKey, thumb, "image/webp");
  } catch (e) {
    console.error(`thumbnail failed for ${photoId}:`, e instanceof Error ? e.message : e);
    tKey = null;
  }

  // No GPS: if this upload targets a specific place (add-to-place), attach it
  // there; otherwise flag for manual placing.
  if (exif.lat === null || exif.lng === null) {
    if (fallbackMemoryId) {
      const m = (await db.select().from(memories).where(eq(memories.id, fallbackMemoryId)).limit(1))[0];
      if (m) {
        await db
          .update(photos)
          .set({
            memoryId: m.id,
            status: "processed",
            takenAt: exif.takenAt ?? photo.createdAt,
            lat: m.lat,
            lng: m.lng,
            width: exif.width,
            height: exif.height,
            s3KeyThumb: tKey,
            exifJson: { ...(exif as any), manualPlace: true } as any,
          })
          .where(eq(photos.id, photoId));
        const tripId = await recomputeMemoryAfterPhotoChange(m.id);
        if (tripId) await recomputeTrip(tripId);
        return;
      }
    }
    await db
      .update(photos)
      .set({
        status: "needs_review",
        takenAt: exif.takenAt,
        width: exif.width,
        height: exif.height,
        s3KeyThumb: tKey,
        exifJson: exif as any,
      })
      .where(eq(photos.id, photoId));
    return;
  }

  const geo = await reverseGeocode(exif.lat, exif.lng);

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
