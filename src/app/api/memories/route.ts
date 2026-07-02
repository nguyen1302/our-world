import { NextResponse } from "next/server";
import { requireRole } from "@/lib/session";
import { getConfig } from "@/lib/config";
import { listTrips } from "@/lib/queries";

export const runtime = "nodejs";

// Returns TRIPS (top-level journey stops). Each marker on the map = a trip.
export async function GET() {
  const guard = await requireRole("viewer");
  if ("response" in guard) return guard.response;

  const memories = await listTrips(getConfig().defaultSpaceId);
  return NextResponse.json({ memories });
}
