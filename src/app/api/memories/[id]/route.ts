import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { requireRole } from "@/lib/session";
import { getConfig } from "@/lib/config";
import { db } from "@/db";
import { trips } from "@/db/schema";
import { getTripDetail } from "@/lib/queries";

export const runtime = "nodejs";

// Trip detail: the trip + its places (member memories), each with its photos.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireRole("viewer");
  if ("response" in guard) return guard.response;

  const detail = await getTripDetail(getConfig().defaultSpaceId, params.id);
  if (!detail) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(detail);
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
