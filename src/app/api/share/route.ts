import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/session";
import { getConfig } from "@/lib/config";
import { createShare, getCurrentShare, type Faces } from "@/lib/share";

export const runtime = "nodejs";

// Build the public URL for a token. Prefer PUBLIC_BASE_URL env; fall back to request headers.
function shareUrl(req: NextRequest, token: string): string {
  const envBase = process.env.PUBLIC_BASE_URL?.replace(/\/$/, "");
  if (envBase) return `${envBase}/s/${token}`;
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host = req.headers.get("host") ?? "localhost:3000";
  return `${proto}://${host}/s/${token}`;
}

export async function GET(req: NextRequest) {
  const guard = await requireRole("admin");
  if ("response" in guard) return guard.response;
  const share = await getCurrentShare(getConfig().defaultSpaceId);
  if (!share) return NextResponse.json({ share: null });
  return NextResponse.json({
    share: {
      id: share.id,
      token: share.token,
      url: shareUrl(req, share.token),
      title: share.title,
      includeMusic: share.includeMusic,
      viewCount: share.viewCount,
      createdAt: share.createdAt,
    },
  });
}

export async function POST(req: NextRequest) {
  const guard = await requireRole("admin");
  if ("response" in guard) return guard.response;
  const body = await req.json().catch(() => null);
  const faces = (body?.faces ?? null) as Faces | null;

  const spaceId = getConfig().defaultSpaceId;
  // reuse the current link if one exists, else create a new one
  let share = await getCurrentShare(spaceId);
  if (!share) {
    share = await createShare(spaceId, {
      title: typeof body?.title === "string" ? body.title : null,
      includeMusic: body?.includeMusic ?? true,
      faces,
    });
  }
  return NextResponse.json({ id: share.id, token: share.token, url: shareUrl(req, share.token) });
}
