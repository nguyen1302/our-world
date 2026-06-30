import { NextResponse } from "next/server";
import { and, eq, isNull, isNotNull } from "drizzle-orm";
import { requireRole } from "@/lib/session";
import { getConfig } from "@/lib/config";
import { db } from "@/db";
import { trips } from "@/db/schema";

export const runtime = "nodejs";

export async function GET() {
  const guard = await requireRole("viewer");
  if ("response" in guard) return guard.response;

  const spaceId = getConfig().defaultSpaceId;
  const rows = await db
    .selectDistinct({ provinceCode: trips.provinceCode })
    .from(trips)
    .where(and(eq(trips.spaceId, spaceId), isNull(trips.deletedAt), isNotNull(trips.provinceCode)));

  return NextResponse.json({ provinceCodes: rows.map((r) => r.provinceCode) });
}
