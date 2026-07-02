import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { resolveShare } from "@/lib/share";
import { db } from "@/db";
import { photos } from "@/db/schema";
import { getStorage } from "@/lib/storage";

export const runtime = "nodejs";

// Presigned ORIGINAL URL for the public lightbox. Verifies the photo belongs to
// the share's space (so a token can't be used to read arbitrary photos).
export async function GET(_req: Request, { params }: { params: { token: string; photoId: string } }) {
  const share = await resolveShare(params.token);
  if (!share) return NextResponse.json({ error: "not found" }, { status: 404 });

  const rows = await db
    .select({ key: photos.s3KeyOriginal })
    .from(photos)
    .where(and(eq(photos.id, params.photoId), eq(photos.spaceId, share.spaceId), isNull(photos.deletedAt)))
    .limit(1);
  if (!rows[0]) return NextResponse.json({ error: "not found" }, { status: 404 });

  const url = await getStorage().presignGet(rows[0].key);
  return NextResponse.json({ url });
}
