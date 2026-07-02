import { NextRequest, NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { requireRole } from "@/lib/session";
import { db } from "@/db";
import { photos, memories, trips } from "@/db/schema";
import { reverseGeocode } from "@/lib/geocode";
import { assignPhotoToMemory, recomputeMemoryAfterPhotoChange, recomputeTrip } from "@/lib/cluster";
import { buildTitle } from "@/lib/title";
import { getStorage, thumbKey } from "@/lib/storage";
import { makeThumbnail } from "@/lib/thumbnail";

export const runtime = "nodejs";

// Assign a no-GPS photo to a place. Three ways:
//  - { memoryId }  → add straight into an existing place (mốc nhỏ)
//  - { tripId }    → add into an existing trip (mốc lớn): joins its nearest-in-time place
//  - { lat, lng }  → drop at a raw point, then geocode + auto-cluster
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireRole("admin");
  if ("response" in guard) return guard.response;

  const body = await req.json().catch(() => null);
  const memoryId = typeof body?.memoryId === "string" ? body.memoryId : null;
  const tripId = typeof body?.tripId === "string" ? body.tripId : null;
  let lat = Number(body?.lat);
  let lng = Number(body?.lng);

  const rows = await db.select().from(photos).where(eq(photos.id, params.id)).limit(1);
  const photo = rows[0];
  if (!photo) return NextResponse.json({ error: "not found" }, { status: 404 });
  const takenAt = photo.takenAt ?? photo.createdAt;

  // Ensure a thumbnail exists (older photos may have none → broken images).
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

  // ---- Attach directly to an existing place / trip -------------------------
  if (memoryId || tripId) {
    let targetMemoryId = memoryId;
    let targetTripId: string | null = null;

    if (memoryId) {
      const mem = (await db.select().from(memories).where(eq(memories.id, memoryId)).limit(1))[0];
      if (!mem) return NextResponse.json({ error: "place not found" }, { status: 404 });
      lat = mem.lat;
      lng = mem.lng;
      targetTripId = mem.tripId;
    } else if (tripId) {
      const trip = (await db.select().from(trips).where(eq(trips.id, tripId)).limit(1))[0];
      if (!trip) return NextResponse.json({ error: "trip not found" }, { status: 404 });
      lat = trip.lat;
      lng = trip.lng;
      targetTripId = trip.id;

      const places = await db
        .select({ id: memories.id, startAt: memories.startAt })
        .from(memories)
        .where(and(eq(memories.tripId, trip.id), isNull(memories.deletedAt)));
      if (places.length) {
        const t = takenAt.getTime();
        targetMemoryId = places.reduce((best, p) =>
          Math.abs(p.startAt.getTime() - t) < Math.abs(best.startAt.getTime() - t) ? p : best,
        ).id;
      } else {
        // trip with no live places → create one at the trip's location
        const geo = await reverseGeocode(trip.lat, trip.lng);
        const ins = await db
          .insert(memories)
          .values({
            spaceId: photo.spaceId,
            title: buildTitle({ placeName: geo.placeName, city: geo.city, startAt: takenAt, endAt: takenAt }),
            country: geo.country,
            city: geo.city,
            placeName: geo.placeName,
            provinceCode: geo.provinceCode,
            lat: trip.lat,
            lng: trip.lng,
            startAt: takenAt,
            endAt: takenAt,
            coverPhotoId: params.id,
            tripId: trip.id,
          })
          .returning({ id: memories.id });
        targetMemoryId = ins[0].id;
      }
    }

    await db
      .update(photos)
      .set({
        lat,
        lng,
        status: "processed",
        s3KeyThumb: thumb,
        memoryId: targetMemoryId,
        exifJson: { ...(photo.exifJson as any), manual: true } as any,
      })
      .where(eq(photos.id, params.id));

    if (targetMemoryId) await recomputeMemoryAfterPhotoChange(targetMemoryId);
    if (targetTripId) await recomputeTrip(targetTripId);
    return NextResponse.json({ ok: true });
  }

  // ---- Raw point → geocode + auto-cluster ----------------------------------
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "lat/lng required" }, { status: 400 });
  }
  const geo = await reverseGeocode(lat, lng);
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
