import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/session";
import { updateShare, type Faces } from "@/lib/share";

export const runtime = "nodejs";

// Update includeMusic / title / re-snapshot faces.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireRole("admin");
  if ("response" in guard) return guard.response;
  const body = await req.json().catch(() => null);
  await updateShare(params.id, {
    title: typeof body?.title === "string" ? body.title : undefined,
    includeMusic: typeof body?.includeMusic === "boolean" ? body.includeMusic : undefined,
    faces: body?.faces !== undefined ? (body.faces as Faces | null) : undefined,
  });
  return NextResponse.json({ ok: true });
}
