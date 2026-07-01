import { NextRequest, NextResponse } from "next/server";
import { and, asc, eq, isNull } from "drizzle-orm";
import { requireRole } from "@/lib/session";
import { db } from "@/db";
import { trips, memories, photos } from "@/db/schema";
import { getStorage } from "@/lib/storage";

export const runtime = "nodejs";

// Trip detail: the trip + its places (member memories), each with its photos.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireRole("viewer");
  if ("response" in guard) return guard.response;

  const rows = await db
    .select()
    .from(trips)
    .where(and(eq(trips.id, params.id), isNull(trips.deletedAt)))
    .limit(1);
  const trip = rows[0];
  if (!trip) return NextResponse.json({ error: "not found" }, { status: 404 });

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

  return NextResponse.json({ trip, places: placeOut });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireRole("admin");
  if ("response" in guard) return guard.response;

  const body = await req.json().catch(() => null);
  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (typeof body?.title === "string") patch.title = body.title;
  if (typeof body?.description === "string" || body?.description === null) patch.description = body.description;
  if (typeof body?.coverPhotoId === "string") patch.coverPhotoId = body.coverPhotoId; // manual trip cover

  await db.update(trips).set(patch).where(eq(trips.id, params.id));
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireRole("admin");
  if ("response" in guard) return guard.response;
  await db.update(trips).set({ deletedAt: new Date() }).where(eq(trips.id, params.id));
  return NextResponse.json({ ok: true });
}
