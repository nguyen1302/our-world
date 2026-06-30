import { NextResponse } from "next/server";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { requireRole } from "@/lib/session";
import { getConfig } from "@/lib/config";
import { db } from "@/db";
import { trips, photos } from "@/db/schema";
import { getStorage } from "@/lib/storage";

export const runtime = "nodejs";

// Returns TRIPS (top-level journey stops). Each marker on the map = a trip.
export async function GET() {
  const guard = await requireRole("viewer");
  if ("response" in guard) return guard.response;

  const spaceId = getConfig().defaultSpaceId;
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

  // photo count per trip (via member memories)
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
      .select({ id: photos.id, thumb: photos.s3KeyThumb })
      .from(photos)
      .where(inArray(photos.id, coverIds));
    for (const c of covers) coverKeyMap.set(c.id, c.thumb);
  }

  const storage = getStorage();
  const result = await Promise.all(
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

  return NextResponse.json({ memories: result });
}
