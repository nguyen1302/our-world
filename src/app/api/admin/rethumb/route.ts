import { NextResponse } from "next/server";
import { and, eq, isNull, sql } from "drizzle-orm";
import { requireRole } from "@/lib/session";
import { getConfig } from "@/lib/config";
import { db } from "@/db";
import { photos } from "@/db/schema";
import { getStorage, thumbKey } from "@/lib/storage";
import { makeThumbnail } from "@/lib/thumbnail";

export const runtime = "nodejs";

// Regenerate thumbnails for photos that have none (e.g. HEIC processed before
// HEIC decode was added). Bounded batch to stay memory-safe on a 1GB host;
// call repeatedly until remaining = 0.
export async function POST() {
  const guard = await requireRole("admin");
  if ("response" in guard) return guard.response;

  const spaceId = getConfig().defaultSpaceId;
  const batch = await db
    .select({ id: photos.id, orig: photos.s3KeyOriginal })
    .from(photos)
    .where(and(eq(photos.spaceId, spaceId), isNull(photos.s3KeyThumb), isNull(photos.deletedAt)))
    .limit(10);

  const storage = getStorage();
  let fixed = 0;
  for (const p of batch) {
    try {
      const original = await storage.getObject(p.orig);
      const buf = await makeThumbnail(original);
      const tKey = thumbKey(spaceId, p.id);
      await storage.putObject(tKey, buf, "image/webp");
      await db.update(photos).set({ s3KeyThumb: tKey }).where(eq(photos.id, p.id));
      fixed++;
    } catch (e) {
      console.error(`rethumb failed ${p.id}:`, e instanceof Error ? e.message : e);
    }
  }

  const remainingRow = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(photos)
    .where(and(eq(photos.spaceId, spaceId), isNull(photos.s3KeyThumb), isNull(photos.deletedAt)));
  const remaining = remainingRow[0]?.n ?? 0;

  return NextResponse.json({ fixed, remaining });
}
