import { NextResponse } from "next/server";
import { requireRole } from "@/lib/session";
import { revokeShare } from "@/lib/share";

export const runtime = "nodejs";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const guard = await requireRole("admin");
  if ("response" in guard) return guard.response;
  await revokeShare(params.id);
  return NextResponse.json({ ok: true });
}
