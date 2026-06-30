import { NextResponse } from "next/server";
import { and, eq, isNull, sql } from "drizzle-orm";
import { requireRole } from "@/lib/session";
import { getConfig } from "@/lib/config";
import { db } from "@/db";
import { memories, photos } from "@/db/schema";

export const runtime = "nodejs";

export async function GET() {
  const guard = await requireRole("viewer");
  if ("response" in guard) return guard.response;

  const spaceId = getConfig().defaultSpaceId;

  const memAgg = await db
    .select({
      memories: sql<number>`count(*)::int`,
      provinces: sql<number>`count(distinct ${memories.provinceCode})::int`,
      countries: sql<number>`count(distinct ${memories.country})::int`,
    })
    .from(memories)
    .where(and(eq(memories.spaceId, spaceId), isNull(memories.deletedAt)));

  const photoAgg = await db
    .select({
      photos: sql<number>`count(*) filter (where ${photos.type} = 'photo')::int`,
      videos: sql<number>`count(*) filter (where ${photos.type} = 'video')::int`,
    })
    .from(photos)
    .where(and(eq(photos.spaceId, spaceId), isNull(photos.deletedAt), eq(photos.status, "processed")));

  return NextResponse.json({
    memories: memAgg[0]?.memories ?? 0,
    photos: photoAgg[0]?.photos ?? 0,
    videos: photoAgg[0]?.videos ?? 0,
    provinces: memAgg[0]?.provinces ?? 0,
    countries: memAgg[0]?.countries ?? 0,
  });
}
