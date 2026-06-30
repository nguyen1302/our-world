import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { requireRole } from "@/lib/session";
import { db } from "@/db";
import { photos } from "@/db/schema";
import { getStorage } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireRole("viewer");
  if ("response" in guard) return guard.response;

  const rows = await db
    .select({ key: photos.s3KeyOriginal })
    .from(photos)
    .where(eq(photos.id, params.id))
    .limit(1);
  if (!rows[0]) return NextResponse.json({ error: "not found" }, { status: 404 });

  const url = await getStorage().presignGet(rows[0].key);
  return NextResponse.json({ url });
}
