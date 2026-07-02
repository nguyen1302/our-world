import { NextResponse } from "next/server";
import { resolveShare, bumpView } from "@/lib/share";
import { getActiveTrackUrl } from "@/lib/queries";

export const runtime = "nodejs";

// Public bootstrap for the /s/[token] page. No auth.
export async function GET(_req: Request, { params }: { params: { token: string } }) {
  const share = await resolveShare(params.token);
  if (!share) return NextResponse.json({ error: "not found" }, { status: 404 });

  await bumpView(share.id);
  const hasMusic = share.includeMusic ? !!(await getActiveTrackUrl(share.spaceId)) : false;

  return NextResponse.json({
    title: share.title,
    includeMusic: share.includeMusic,
    hasMusic,
    faces: share.facesJson ?? { a: null, b: null },
  });
}
