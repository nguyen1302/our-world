import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";

// Methods that mutate require an admin session.
const WRITE_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"]);

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const secret = process.env.AUTH_SECRET || "";
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = await verifySessionToken(token, secret);

  // Login endpoint + page are always reachable.
  const isAuthApi = pathname.startsWith("/api/auth/");
  if (isAuthApi || pathname === "/login") {
    return NextResponse.next();
  }

  // Public share link: the /s/[token] viewer page + its read-only API must be
  // reachable logged-out. (The API itself validates the token + read-only scope.)
  if (pathname.startsWith("/s/") || pathname.startsWith("/api/public/")) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    if (!session) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    if (WRITE_METHODS.has(req.method) && session.role !== "admin") {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    return NextResponse.next();
  }

  // Page routes: require any session, else redirect to login.
  if (!session) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.geojson|.*\\.png|.*\\.svg).*)"],
};
