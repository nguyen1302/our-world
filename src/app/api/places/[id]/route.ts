import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { requireRole } from "@/lib/session";
import { db } from "@/db";
import { memories } from "@/db/schema";

export const runtime = "nodejs";

// Edit a place (a member Memory of a trip): title / description.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireRole("admin");
  if ("response" in guard) return guard.response;

  const body = await req.json().catch(() => null);
  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (typeof body?.title === "string") patch.title = body.title;
  if (typeof body?.description === "string" || body?.description === null) patch.description = body.description;

  await db.update(memories).set(patch).where(eq(memories.id, params.id));
  return NextResponse.json({ ok: true });
}
