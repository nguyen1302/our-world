import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getConfig } from "./config";
import { SESSION_COOKIE, verifySessionToken, type Session } from "./auth";

export async function getSession(): Promise<Session | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  return verifySessionToken(token, getConfig().authSecret);
}

/** Returns the session if role >= required, else a 401/403 NextResponse. */
export async function requireRole(
  required: "admin" | "viewer",
): Promise<{ session: Session } | { response: NextResponse }> {
  const session = await getSession();
  if (!session) {
    return { response: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  }
  if (required === "admin" && session.role !== "admin") {
    return { response: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  }
  return { session };
}
