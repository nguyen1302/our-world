import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { requireRole } from "@/lib/session";
import { db } from "@/db";
import { memories } from "@/db/schema";
import { recomputeTrip } from "@/lib/cluster";

export const runtime = "nodejs";

// Edit a place (a member Memory of a trip): title / description / cover photo.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireRole("admin");
  if ("response" in guard) return guard.response;

  const body = await req.json().catch(() => null);
  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (typeof body?.title === "string") patch.title = body.title;
  if (typeof body?.description === "string" || body?.description === null) patch.description = body.description;
  if (typeof body?.coverPhotoId === "string") patch.coverPhotoId = body.coverPhotoId;

  await db.update(memories).set(patch).where(eq(memories.id, params.id));

  // cover change may affect the trip's cover (trip cover = earliest place's cover)
  if (typeof body?.coverPhotoId === "string") {
    const rows = await db.select({ tripId: memories.tripId }).from(memories).where(eq(memories.id, params.id)).limit(1);
    if (rows[0]?.tripId) await recomputeTrip(rows[0].tripId);
  }

  return NextResponse.json({ ok: true });
}
