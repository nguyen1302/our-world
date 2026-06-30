import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getConfig } from "@/lib/config";
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const config = getConfig();
  const body = await req.json().catch(() => null);
  const username = body?.username;
  const password = body?.password;
  if (typeof username !== "string" || typeof password !== "string") {
    return NextResponse.json({ error: "username and password required" }, { status: 400 });
  }

  const user = config.users.find((u) => u.username === username);
  const ok = user ? await bcrypt.compare(password, user.passwordHash) : false;
  if (!user || !ok) {
    return NextResponse.json({ error: "invalid credentials" }, { status: 401 });
  }

  const token = await createSessionToken({ username: user.username, role: user.role }, config.authSecret);
  const res = NextResponse.json({ username: user.username, role: user.role });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return res;
}
