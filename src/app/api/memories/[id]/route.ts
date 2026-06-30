import { NextRequest, NextResponse } from "next/server";
import { and, asc, eq, isNull } from "drizzle-orm";
import { requireRole } from "@/lib/session";
import { db } from "@/db";
import { memories, photos } from "@/db/schema";
import { getStorage } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireRole("viewer");
  if ("response" in guard) return guard.response;

  const rows = await db
    .select()
    .from(memories)
    .where(and(eq(memories.id, params.id), isNull(memories.deletedAt)))
    .limit(1);
  const memory = rows[0];
  if (!memory) return NextResponse.json({ error: "not found" }, { status: 404 });

  const pics = await db
    .select({ id: photos.id, thumb: photos.s3KeyThumb })
    .from(photos)
    .where(and(eq(photos.memoryId, memory.id), isNull(photos.deletedAt), eq(photos.status, "processed")))
    .orderBy(asc(photos.takenAt));

  const storage = getStorage();
  const gallery = await Promise.all(
    pics.map(async (p) => ({
      id: p.id,
      thumbUrl: p.thumb ? await storage.presignGet(p.thumb) : null,
    })),
  );

  return NextResponse.json({ memory, photos: gallery });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireRole("admin");
  if ("response" in guard) return guard.response;

  const body = await req.json().catch(() => null);
  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (typeof body?.title === "string") patch.title = body.title;
  if (typeof body?.description === "string" || body?.description === null)
    patch.description = body.description;

  await db.update(memories).set(patch).where(eq(memories.id, params.id));
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireRole("admin");
  if ("response" in guard) return guard.response;

  await db.update(memories).set({ deletedAt: new Date() }).where(eq(memories.id, params.id));
  return NextResponse.json({ ok: true });
}
