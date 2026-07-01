import { NextResponse } from "next/server";
import { and, asc, eq, isNull } from "drizzle-orm";
import { requireRole } from "@/lib/session";
import { getConfig } from "@/lib/config";
import { db } from "@/db";
import { photos } from "@/db/schema";
import { getStorage } from "@/lib/storage";

export const runtime = "nodejs";

// Photos with no GPS (needs_review) — to be placed on the map manually by admin.
export async function GET() {
  const guard = await requireRole("viewer");
  if ("response" in guard) return guard.response;

  const spaceId = getConfig().defaultSpaceId;
  const rows = await db
    .select({ id: photos.id, thumb: photos.s3KeyThumb, orig: photos.s3KeyOriginal, takenAt: photos.takenAt })
    .from(photos)
    .where(and(eq(photos.spaceId, spaceId), eq(photos.status, "needs_review"), isNull(photos.deletedAt)))
    .orderBy(asc(photos.takenAt));

  const storage = getStorage();
  // fall back to the original when a thumbnail is missing (e.g. photos processed
  // before thumbnails-for-needs_review existed)
  const items = await Promise.all(
    rows.map(async (r) => ({
      id: r.id,
      takenAt: r.takenAt,
      thumbUrl: await storage.presignGet(r.thumb ?? r.orig),
    })),
  );

  return NextResponse.json({ photos: items });
}
