import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { requireRole } from "@/lib/session";
import { db } from "@/db";
import { photos } from "@/db/schema";
import { reverseGeocode } from "@/lib/geocode";
import { assignPhotoToMemory } from "@/lib/cluster";
import { getStorage, thumbKey } from "@/lib/storage";
import { makeThumbnail } from "@/lib/thumbnail";

export const runtime = "nodejs";

// Manually assign a location to a no-GPS photo, then geocode + cluster it into a Trip/Place.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireRole("admin");
  if ("response" in guard) return guard.response;

  const body = await req.json().catch(() => null);
  const lat = Number(body?.lat);
  const lng = Number(body?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "lat/lng required" }, { status: 400 });
  }

  const rows = await db.select().from(photos).where(eq(photos.id, params.id)).limit(1);
  const photo = rows[0];
  if (!photo) return NextResponse.json({ error: "not found" }, { status: 404 });

  const geo = await reverseGeocode(lat, lng);
  const takenAt = photo.takenAt ?? photo.createdAt;

  // Ensure a thumbnail exists (older photos processed before thumbs-for-needs_review
  // have none → would show broken images on the map/card/timeline).
  let thumb = photo.s3KeyThumb;
  if (!thumb) {
    try {
      const storage = getStorage();
      const original = await storage.getObject(photo.s3KeyOriginal);
      const buf = await makeThumbnail(original);
      const tKey = thumbKey(photo.spaceId, params.id);
      await storage.putObject(tKey, buf, "image/webp");
      thumb = tKey;
    } catch (e) {
      console.error("locate thumbnail failed:", e instanceof Error ? e.message : e);
    }
  }

  await db
    .update(photos)
    .set({
      lat,
      lng,
      status: "processed",
      s3KeyThumb: thumb,
      exifJson: { ...(photo.exifJson as any), manual: true } as any,
    })
    .where(eq(photos.id, params.id));

  await assignPhotoToMemory({ id: params.id, spaceId: photo.spaceId, lat, lng, takenAt }, geo);

  return NextResponse.json({ ok: true, place: geo.placeName || geo.city || null });
}
