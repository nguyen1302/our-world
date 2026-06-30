import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { requireRole } from "@/lib/session";
import { getConfig } from "@/lib/config";
import { db } from "@/db";
import { tracks } from "@/db/schema";
import { getStorage, audioKey } from "@/lib/storage";

export const runtime = "nodejs";

// List tracks + a presigned URL for the active one.
export async function GET() {
  const guard = await requireRole("viewer");
  if ("response" in guard) return guard.response;
  const spaceId = getConfig().defaultSpaceId;

  const rows = await db
    .select({ id: tracks.id, name: tracks.name, isActive: tracks.isActive, key: tracks.s3Key })
    .from(tracks)
    .where(eq(tracks.spaceId, spaceId))
    .orderBy(desc(tracks.createdAt));

  const active = rows.find((r) => r.isActive);
  const activeUrl = active ? await getStorage().presignGet(active.key, 6 * 3600) : null;

  return NextResponse.json({
    tracks: rows.map((r) => ({ id: r.id, name: r.name, isActive: r.isActive })),
    activeId: active?.id ?? null,
    activeUrl,
  });
}

// Step 1: presign an audio upload.
export async function POST(req: NextRequest) {
  const guard = await requireRole("admin");
  if ("response" in guard) return guard.response;

  const body = await req.json().catch(() => null);
  const action = body?.action;
  const spaceId = getConfig().defaultSpaceId;

  if (action === "presign") {
    const contentType: string = body?.contentType ?? "";
    if (!contentType.startsWith("audio/")) {
      return NextResponse.json({ error: "only audio/* allowed" }, { status: 400 });
    }
    const id = randomUUID();
    const key = audioKey(spaceId, id, contentType);
    const url = await getStorage().presignPut(key, contentType);
    return NextResponse.json({ key, url });
  }

  if (action === "complete") {
    const key: string = body?.key;
    const name: string = (body?.name || "Bài hát").slice(0, 120);
    if (!key) return NextResponse.json({ error: "key required" }, { status: 400 });
    // new upload becomes the active track
    await db.update(tracks).set({ isActive: false }).where(eq(tracks.spaceId, spaceId));
    await db.insert(tracks).values({ spaceId, name, s3Key: key, isActive: true });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
