import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/session";
import { getConfig } from "@/lib/config";
import { db } from "@/db";
import { photos } from "@/db/schema";
import { enqueue } from "@/lib/jobs";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const guard = await requireRole("admin");
  if ("response" in guard) return guard.response;

  const body = await req.json().catch(() => null);
  const keys = body?.keys;
  // Optional: attach no-GPS photos to this place (memory) instead of "needs_review".
  const fallbackMemoryId: string | undefined =
    typeof body?.fallbackMemoryId === "string" ? body.fallbackMemoryId : undefined;
  if (!Array.isArray(keys) || keys.length === 0) {
    return NextResponse.json({ error: "keys[] required" }, { status: 400 });
  }

  const spaceId = getConfig().defaultSpaceId;
  const created: string[] = [];

  for (const k of keys) {
    const key: string = k?.key;
    const contentType: string = k?.contentType ?? "";
    if (!key || !contentType.startsWith("image/")) continue;
    const inserted = await db
      .insert(photos)
      .values({ spaceId, type: "photo", s3KeyOriginal: key, status: "pending" })
      .returning({ id: photos.id });
    const photoId = inserted[0].id;
    await enqueue("process_photo", { photoId, fallbackMemoryId });
    created.push(photoId);
  }

  return NextResponse.json({ created });
}
