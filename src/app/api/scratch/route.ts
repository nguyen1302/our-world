import { NextResponse } from "next/server";
import { requireRole } from "@/lib/session";
import { getConfig } from "@/lib/config";
import { getScratch } from "@/lib/queries";

export const runtime = "nodejs";

export async function GET() {
  const guard = await requireRole("viewer");
  if ("response" in guard) return guard.response;
  return NextResponse.json({ provinceCodes: await getScratch(getConfig().defaultSpaceId) });
}
