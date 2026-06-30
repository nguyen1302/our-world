import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { requireRole } from "@/lib/session";
import { getConfig } from "@/lib/config";
import { db } from "@/db";
import { tracks } from "@/db/schema";

export const runtime = "nodejs";

// Set this track as the active one.
export async function PATCH(_req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireRole("admin");
  if ("response" in guard) return guard.response;
  const spaceId = getConfig().defaultSpaceId;
  await db.update(tracks).set({ isActive: false }).where(eq(tracks.spaceId, spaceId));
  await db.update(tracks).set({ isActive: true }).where(eq(tracks.id, params.id));
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireRole("admin");
  if ("response" in guard) return guard.response;
  await db.delete(tracks).where(eq(tracks.id, params.id));
  return NextResponse.json({ ok: true });
}
