import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { requireRole } from "@/lib/session";
import { db } from "@/db";
import { photos } from "@/db/schema";
import { getStorage } from "@/lib/storage";
import { recomputeMemoryAfterPhotoChange, recomputeTrip } from "@/lib/cluster";

export const runtime = "nodejs";

// Hard-delete a photo: remove its S3 objects (original + thumbnail) and DB row,
// then recompute the owning place/trip (cover, bounds; delete if now empty).
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireRole("admin");
  if ("response" in guard) return guard.response;

  const rows = await db.select().from(photos).where(eq(photos.id, params.id)).limit(1);
  const photo = rows[0];
  if (!photo) return NextResponse.json({ error: "not found" }, { status: 404 });

  const storage = getStorage();
  await Promise.allSettled([
    storage.deleteObject(photo.s3KeyOriginal),
    photo.s3KeyThumb ? storage.deleteObject(photo.s3KeyThumb) : Promise.resolve(),
  ]);

  await db.delete(photos).where(eq(photos.id, params.id));

  if (photo.memoryId) {
    const tripId = await recomputeMemoryAfterPhotoChange(photo.memoryId);
    if (tripId) await recomputeTrip(tripId);
  }

  return NextResponse.json({ ok: true });
}
