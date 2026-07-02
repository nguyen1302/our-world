// Shared read queries used by BOTH the authenticated API and the public share API.
// No auth inside — callers pass the spaceId they're allowed to read. Response shapes
// here are the single source of truth so authed + public views stay identical.
import { and, asc, desc, eq, isNull, isNotNull, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { trips, memories, photos, tracks } from "@/db/schema";
import { getStorage } from "@/lib/storage";

export async function listTrips(spaceId: string) {
  const rows = await db
    .select({
      id: trips.id,
      title: trips.title,
      lat: trips.lat,
      lng: trips.lng,
      startAt: trips.startAt,
      endAt: trips.endAt,
      provinceCode: trips.provinceCode,
      city: trips.city,
      coverPhotoId: trips.coverPhotoId,
    })
    .from(trips)
    .where(and(eq(trips.spaceId, spaceId), isNull(trips.deletedAt)))
    .orderBy(asc(trips.startAt));

  const counts = await db.execute(sql`
    SELECT m.trip_id AS trip_id, count(p.id)::int AS n
    FROM memories m JOIN photos p ON p.memory_id = m.id
    WHERE m.space_id = ${spaceId} AND m.deleted_at IS NULL AND p.deleted_at IS NULL AND m.trip_id IS NOT NULL
    GROUP BY m.trip_id
  `);
  const countMap = new Map<string, number>();
  for (const r of (counts as any).rows ?? []) countMap.set(r.trip_id, r.n);

  const coverIds = rows.map((r) => r.coverPhotoId).filter(Boolean) as string[];
  const coverKeyMap = new Map<string, string | null>();
  if (coverIds.length) {
    const covers = await db
      .select({ id: photos.id, thumb: photos.s3KeyThumb, orig: photos.s3KeyOriginal })
      .from(photos)
      .where(inArray(photos.id, coverIds));
    for (const c of covers) coverKeyMap.set(c.id, c.thumb ?? c.orig);
  }

  const storage = getStorage();
  return Promise.all(
    rows.map(async (r) => {
      const thumbKey = r.coverPhotoId ? coverKeyMap.get(r.coverPhotoId) : null;
      const coverThumbUrl = thumbKey ? await storage.presignGet(thumbKey) : null;
      return {
        id: r.id,
        title: r.title,
        lat: r.lat,
        lng: r.lng,
        startAt: r.startAt,
        endAt: r.endAt,
        provinceCode: r.provinceCode,
        city: r.city,
        coverThumbUrl,
        photoCount: countMap.get(r.id) ?? 0,
      };
    }),
  );
}

/** Trip detail scoped to spaceId. Returns null if the trip isn't in this space. */
export async function getTripDetail(spaceId: string, tripId: string) {
  const rows = await db
    .select()
    .from(trips)
    .where(and(eq(trips.id, tripId), eq(trips.spaceId, spaceId), isNull(trips.deletedAt)))
    .limit(1);
  const trip = rows[0];
  if (!trip) return null;

  const places = await db
    .select()
    .from(memories)
    .where(and(eq(memories.tripId, trip.id), isNull(memories.deletedAt)))
    .orderBy(asc(memories.startAt));

  const storage = getStorage();
  const placeOut = await Promise.all(
    places.map(async (p) => {
      const pics = await db
        .select({ id: photos.id, thumb: photos.s3KeyThumb, orig: photos.s3KeyOriginal })
        .from(photos)
        .where(and(eq(photos.memoryId, p.id), isNull(photos.deletedAt), eq(photos.status, "processed")))
        .orderBy(asc(photos.takenAt));
      const gallery = await Promise.all(
        pics.map(async (x) => ({ id: x.id, thumbUrl: await storage.presignGet(x.thumb ?? x.orig) })),
      );
      return {
        id: p.id,
        title: p.title,
        description: p.description,
        placeName: p.placeName,
        city: p.city,
        country: p.country,
        lat: p.lat,
        lng: p.lng,
        startAt: p.startAt,
        endAt: p.endAt,
        coverPhotoId: p.coverPhotoId,
        photos: gallery,
      };
    }),
  );

  return { trip, places: placeOut };
}

export async function getStats(spaceId: string) {
  const memAgg = await db
    .select({
      memories: sql<number>`count(*)::int`,
      provinces: sql<number>`count(distinct ${trips.provinceCode})::int`,
      countries: sql<number>`count(distinct ${trips.country})::int`,
    })
    .from(trips)
    .where(and(eq(trips.spaceId, spaceId), isNull(trips.deletedAt)));

  const photoAgg = await db
    .select({
      photos: sql<number>`count(*) filter (where ${photos.type} = 'photo')::int`,
      videos: sql<number>`count(*) filter (where ${photos.type} = 'video')::int`,
    })
    .from(photos)
    .where(and(eq(photos.spaceId, spaceId), isNull(photos.deletedAt), eq(photos.status, "processed")));

  return {
    memories: memAgg[0]?.memories ?? 0,
    photos: photoAgg[0]?.photos ?? 0,
    videos: photoAgg[0]?.videos ?? 0,
    provinces: memAgg[0]?.provinces ?? 0,
    countries: memAgg[0]?.countries ?? 0,
  };
}

export async function getScratch(spaceId: string) {
  const rows = await db
    .selectDistinct({ provinceCode: trips.provinceCode })
    .from(trips)
    .where(and(eq(trips.spaceId, spaceId), isNull(trips.deletedAt), isNotNull(trips.provinceCode)));
  return rows.map((r) => r.provinceCode);
}

export async function getActiveTrackUrl(spaceId: string) {
  const active = (
    await db
      .select({ key: tracks.s3Key })
      .from(tracks)
      .where(and(eq(tracks.spaceId, spaceId), eq(tracks.isActive, true)))
      .orderBy(desc(tracks.createdAt))
      .limit(1)
  )[0];
  return active ? getStorage().presignGet(active.key, 6 * 3600) : null;
}
