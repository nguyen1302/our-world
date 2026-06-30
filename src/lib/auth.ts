import { SignJWT, jwtVerify } from "jose";
import type { Role } from "./config";

export const SESSION_COOKIE = "ow_session";
const ALG = "HS256";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

export interface Session {
  username: string;
  role: Role;
}

function key(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(session: Session, secret: string): Promise<string> {
  return await new SignJWT({ role: session.role })
    .setProtectedHeader({ alg: ALG })
    .setSubject(session.username)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(key(secret));
}

export async function verifySessionToken(
  token: string | undefined,
  secret: string,
): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(secret));
    const role = payload.role;
    if (typeof payload.sub !== "string") return null;
    if (role !== "admin" && role !== "viewer") return null;
    return { username: payload.sub, role };
  } catch {
    return null;
  }
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  };
}
