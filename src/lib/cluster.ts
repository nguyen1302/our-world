import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { memories, photos } from "@/db/schema";
import { getConfig } from "./config";
import { buildTitle } from "./title";
import type { GeoResult } from "./geocode";

export interface ClusterConfig {
  distanceKm: number;
  gapHours: number;
}

export interface MemoryBounds {
  id: string;
  lat: number;
  lng: number;
  startAt: Date;
  endAt: Date;
}

export interface PhotoPoint {
  lat: number;
  lng: number;
  takenAt: Date;
}

export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Pick the memory a photo belongs to: within distanceKm of the memory center
 * AND within gapHours of its [startAt, endAt] window. Among matches, choose the
 * one closest in time. Returns the memory id, or null to create a new memory.
 */
export function pickMemory(
  candidates: MemoryBounds[],
  photo: PhotoPoint,
  cfg: ClusterConfig,
): string | null {
  const gapMs = cfg.gapHours * 3600 * 1000;
  const t = photo.takenAt.getTime();
  let best: { id: string; timeDist: number } | null = null;

  for (const m of candidates) {
    const dist = haversineKm(m, photo);
    if (dist > cfg.distanceKm) continue;
    const start = m.startAt.getTime();
    const end = m.endAt.getTime();
    const timeDist = t < start ? start - t : t > end ? t - end : 0;
    if (timeDist > gapMs) continue;
    if (!best || timeDist < best.timeDist) best = { id: m.id, timeDist };
  }
  return best?.id ?? null;
}

/** Assign a processed photo to an existing memory or create a new one. */
export async function assignPhotoToMemory(
  photo: { id: string; spaceId: string; lat: number; lng: number; takenAt: Date },
  geo: GeoResult,
): Promise<string> {
  const cfg = getConfig();
  const clusterCfg: ClusterConfig = {
    distanceKm: cfg.clusterDistanceKm,
    gapHours: cfg.clusterTimeGapHours,
  };

  const existing = await db
    .select({
      id: memories.id,
      lat: memories.lat,
      lng: memories.lng,
      startAt: memories.startAt,
      endAt: memories.endAt,
    })
    .from(memories)
    .where(and(eq(memories.spaceId, photo.spaceId), isNull(memories.deletedAt)));

  const matchId = pickMemory(existing as MemoryBounds[], photo, clusterCfg);

  if (matchId) {
    const m = (existing as MemoryBounds[]).find((x) => x.id === matchId)!;
    const newStart = photo.takenAt < m.startAt ? photo.takenAt : m.startAt;
    const newEnd = photo.takenAt > m.endAt ? photo.takenAt : m.endAt;
    await db
      .update(memories)
      .set({ startAt: newStart, endAt: newEnd, updatedAt: new Date() })
      .where(eq(memories.id, matchId));
    await db.update(photos).set({ memoryId: matchId }).where(eq(photos.id, photo.id));
    return matchId;
  }

  const title = buildTitle({
    placeName: geo.placeName,
    city: geo.city,
    startAt: photo.takenAt,
    endAt: photo.takenAt,
  });

  const inserted = await db
    .insert(memories)
    .values({
      spaceId: photo.spaceId,
      title,
      country: geo.country,
      city: geo.city,
      placeName: geo.placeName,
      provinceCode: geo.provinceCode,
      lat: photo.lat,
      lng: photo.lng,
      startAt: photo.takenAt,
      endAt: photo.takenAt,
      coverPhotoId: photo.id,
    })
    .returning({ id: memories.id });

  const memoryId = inserted[0].id;
  await db.update(photos).set({ memoryId }).where(eq(photos.id, photo.id));
  return memoryId;
}
