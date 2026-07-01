import { NextResponse } from "next/server";
import { and, asc, eq, isNotNull, isNull } from "drizzle-orm";
import { requireRole } from "@/lib/session";
import { getConfig } from "@/lib/config";
import { db } from "@/db";
import { memories } from "@/db/schema";

export const runtime = "nodejs";

// Ordered list of all PLACES (with their trip) for the full journey replay.
export async function GET() {
  const guard = await requireRole("viewer");
  if ("response" in guard) return guard.response;

  const spaceId = getConfig().defaultSpaceId;
  const rows = await db
    .select({
      id: memories.id,
      tripId: memories.tripId,
      lat: memories.lat,
      lng: memories.lng,
      title: memories.title,
      placeName: memories.placeName,
    })
    .from(memories)
    .where(and(eq(memories.spaceId, spaceId), isNull(memories.deletedAt), isNotNull(memories.tripId)))
    .orderBy(asc(memories.startAt));

  return NextResponse.json({
    stops: rows.map((r) => ({
      id: r.id,
      tripId: r.tripId,
      lat: r.lat,
      lng: r.lng,
      title: r.placeName || r.title,
    })),
  });
}
