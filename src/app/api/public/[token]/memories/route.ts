import { NextResponse } from "next/server";
import { resolveShare } from "@/lib/share";
import { listTrips } from "@/lib/queries";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: { token: string } }) {
  const share = await resolveShare(params.token);
  if (!share) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ memories: await listTrips(share.spaceId) });
}
