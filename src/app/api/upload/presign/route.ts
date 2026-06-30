import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { requireRole } from "@/lib/session";
import { getConfig } from "@/lib/config";
import { getStorage, originalKey } from "@/lib/storage";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const guard = await requireRole("admin");
  if ("response" in guard) return guard.response;

  const body = await req.json().catch(() => null);
  const files = body?.files;
  if (!Array.isArray(files) || files.length === 0) {
    return NextResponse.json({ error: "files[] required" }, { status: 400 });
  }
  if (files.length > 80) {
    return NextResponse.json(
      { error: "Tối đa 80 ảnh mỗi lần — hãy chia thành nhiều lần upload." },
      { status: 400 },
    );
  }

  const spaceId = getConfig().defaultSpaceId;
  const storage = getStorage();
  const items = [];

  for (const f of files) {
    const contentType: string = f?.contentType ?? "";
    if (!contentType.startsWith("image/")) {
      return NextResponse.json(
        { error: `only image/* allowed (got "${contentType}")` },
        { status: 400 },
      );
    }
    const id = randomUUID();
    const key = originalKey(spaceId, id, contentType);
    const url = await storage.presignPut(key, contentType);
    items.push({ id, key, contentType, url });
  }

  return NextResponse.json({ items });
}
