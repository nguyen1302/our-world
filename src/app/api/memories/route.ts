import { NextResponse } from "next/server";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { requireRole } from "@/lib/session";
import { getConfig } from "@/lib/config";
import { db } from "@/db";
import { memories, photos } from "@/db/schema";
import { getStorage } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET() {
  const guard = await requireRole("viewer");
  if ("response" in guard) return guard.response;

  const spaceId = getConfig().defaultSpaceId;
  const rows = await db
    .select({
      id: memories.id,
      title: memories.title,
      lat: memories.lat,
      lng: memories.lng,
      startAt: memories.startAt,
      endAt: memories.endAt,
      provinceCode: memories.provinceCode,
      city: memories.city,
      coverPhotoId: memories.coverPhotoId,
    })
    .from(memories)
    .where(and(eq(memories.spaceId, spaceId), isNull(memories.deletedAt)))
    .orderBy(asc(memories.startAt));

  // photo counts per memory
  const counts = await db
    .select({ memoryId: photos.memoryId, n: sql<number>`count(*)::int` })
    .from(photos)
    .where(and(eq(photos.spaceId, spaceId), isNull(photos.deletedAt)))
    .groupBy(photos.memoryId);
  const countMap = new Map(counts.map((c) => [c.memoryId, c.n]));

  // cover thumb keys
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
