import { randomBytes } from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { shares, type Share } from "@/db/schema";

export type Faces = { a: string | null; b: string | null };

// URL-safe, unguessable token (~132 bits). base62-ish via base64url stripped of symbols.
function genToken(): string {
  return randomBytes(24).toString("base64url").replace(/[-_]/g, "").slice(0, 22);
}

export async function createShare(
  spaceId: string,
  opts: { title?: string | null; includeMusic?: boolean; faces?: Faces | null } = {},
): Promise<Share> {
  // retry a couple times on the (astronomically unlikely) unique-token collision
  for (let i = 0; i < 3; i++) {
    try {
      const rows = await db
        .insert(shares)
        .values({
          spaceId,
          token: genToken(),
          title: opts.title ?? null,
          includeMusic: opts.includeMusic ?? true,
          facesJson: (opts.faces ?? null) as any,
        })
        .returning();
      return rows[0];
    } catch (e) {
      if (i === 2) throw e;
    }
  }
  throw new Error("could not create share");
}

/** Most recent non-revoked share for a space (the "current" link), or null. */
export async function getCurrentShare(spaceId: string): Promise<Share | null> {
  const rows = await db
    .select()
    .from(shares)
    .where(and(eq(shares.spaceId, spaceId), eq(shares.revoked, false)))
    .orderBy(desc(shares.createdAt))
    .limit(1);
  return rows[0] ?? null;
}

/** Resolve a token to a live share, or null if missing / revoked / expired. */
export async function resolveShare(token: string): Promise<Share | null> {
  if (!token) return null;
  const rows = await db.select().from(shares).where(eq(shares.token, token)).limit(1);
  const s = rows[0];
  if (!s || s.revoked) return null;
  if (s.expiresAt && s.expiresAt.getTime() < Date.now()) return null;
  return s;
}

export async function revokeShare(id: string): Promise<void> {
  await db.update(shares).set({ revoked: true }).where(eq(shares.id, id));
}

export async function updateShare(
  id: string,
  patch: { title?: string | null; includeMusic?: boolean; faces?: Faces | null },
): Promise<void> {
  const set: Record<string, unknown> = {};
  if (patch.title !== undefined) set.title = patch.title;
  if (patch.includeMusic !== undefined) set.includeMusic = patch.includeMusic;
  if (patch.faces !== undefined) set.facesJson = patch.faces as any;
  if (Object.keys(set).length) await db.update(shares).set(set).where(eq(shares.id, id));
}

export async function bumpView(id: string): Promise<void> {
  await db
    .update(shares)
    .set({ viewCount: sql`${shares.viewCount} + 1` })
    .where(eq(shares.id, id))
    .catch(() => {});
}
