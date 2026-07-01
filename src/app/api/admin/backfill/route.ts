import { NextResponse } from "next/server";
import { and, eq, isNull, isNotNull } from "drizzle-orm";
import { requireRole } from "@/lib/session";
import { getConfig } from "@/lib/config";
import { db } from "@/db";
import { memories, trips } from "@/db/schema";
import { pointProvince } from "@/lib/provincesGeo";
import { recomputeTrip } from "@/lib/cluster";

export const runtime = "nodejs";

// Backfill province/city for existing places using offline point-in-polygon,
// then recompute every trip (title/province). Fixes "0 tỉnh thành" without re-upload.
export async function POST() {
  const guard = await requireRole("admin");
  if ("response" in guard) return guard.response;
  const spaceId = getConfig().defaultSpaceId;

  const places = await db
    .select({ id: memories.id, lat: memories.lat, lng: memories.lng, city: memories.city, tripId: memories.tripId })
    .from(memories)
    .where(and(eq(memories.spaceId, spaceId), isNull(memories.deletedAt)));

  let updated = 0;
  const tripIds = new Set<string>();
  for (const p of places) {
    if (p.tripId) tripIds.add(p.tripId);
    const prov = pointProvince(p.lat, p.lng);
    if (!prov) continue;
    await db
      .update(memories)
      .set({ provinceCode: prov.code, country: "Việt Nam", city: p.city ?? prov.name })
      .where(eq(memories.id, p.id));
    updated++;
  }

  const allTrips = await db
    .select({ id: trips.id })
    .from(trips)
    .where(and(eq(trips.spaceId, spaceId), isNull(trips.deletedAt), isNotNull(trips.id)));
  for (const t of allTrips) await recomputeTrip(t.id);

  return NextResponse.json({ updated, trips: allTrips.length });
}
