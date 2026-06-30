import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { memories, photos, trips } from "@/db/schema";
import { getConfig } from "./config";
import { buildTitle, formatDateRange } from "./title";
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

  let memoryId: string;
  if (matchId) {
    const m = (existing as MemoryBounds[]).find((x) => x.id === matchId)!;
    const newStart = photo.takenAt < m.startAt ? photo.takenAt : m.startAt;
    const newEnd = photo.takenAt > m.endAt ? photo.takenAt : m.endAt;
    await db
      .update(memories)
      .set({ startAt: newStart, endAt: newEnd, updatedAt: new Date() })
      .where(eq(memories.id, matchId));
    await db.update(photos).set({ memoryId: matchId }).where(eq(photos.id, photo.id));
    memoryId = matchId;
  } else {
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
    memoryId = inserted[0].id;
    await db.update(photos).set({ memoryId }).where(eq(photos.id, photo.id));
  }

  await assignMemoryToTrip(memoryId, photo.spaceId, photo, geo);
  return memoryId;
}

/** Group a place-memory into a Trip (e.g. a multi-day, multi-place trip). */
export async function assignMemoryToTrip(
  memoryId: string,
  spaceId: string,
  point: PhotoPoint,
  geo: GeoResult,
): Promise<string> {
  const cfg = getConfig();
  const tripCfg: ClusterConfig = { distanceKm: cfg.tripDistanceKm, gapHours: cfg.tripGapHours };

  const existing = await db
    .select({ id: trips.id, lat: trips.lat, lng: trips.lng, startAt: trips.startAt, endAt: trips.endAt })
    .from(trips)
    .where(and(eq(trips.spaceId, spaceId), isNull(trips.deletedAt)));

  let tripId = pickMemory(existing as MemoryBounds[], point, tripCfg);

  if (!tripId) {
    const inserted = await db
      .insert(trips)
      .values({
        spaceId,
        title: `${geo.city || geo.placeName || "Chuyến đi"}`,
        country: geo.country,
        city: geo.city,
        provinceCode: geo.provinceCode,
        lat: point.lat,
        lng: point.lng,
        startAt: point.takenAt,
        endAt: point.takenAt,
      })
      .returning({ id: trips.id });
    tripId = inserted[0].id;
  }

  await db.update(memories).set({ tripId }).where(eq(memories.id, memoryId));
  await recomputeTrip(tripId);
  return tripId;
}

/** Recompute a trip's bounds/centroid/cover/title from its member memories. */
export async function recomputeTrip(tripId: string): Promise<void> {
  const members = await db
    .select({
      lat: memories.lat,
      lng: memories.lng,
      startAt: memories.startAt,
      endAt: memories.endAt,
      city: memories.city,
      provinceCode: memories.provinceCode,
      country: memories.country,
      coverPhotoId: memories.coverPhotoId,
    })
    .from(memories)
    .where(and(eq(memories.tripId, tripId), isNull(memories.deletedAt)));

  if (members.length === 0) return;

  const lat = members.reduce((s, m) => s + m.lat, 0) / members.length;
  const lng = members.reduce((s, m) => s + m.lng, 0) / members.length;
  const start = members.reduce((a, m) => (m.startAt < a ? m.startAt : a), members[0].startAt);
  const end = members.reduce((a, m) => (m.endAt > a ? m.endAt : a), members[0].endAt);
  const earliest = [...members].sort((a, b) => a.startAt.getTime() - b.startAt.getTime())[0];
  const city = members.find((m) => m.city)?.city ?? null;
  const province = members.find((m) => m.provinceCode)?.provinceCode ?? null;
  const country = members.find((m) => m.country)?.country ?? null;
  const title = `${city || "Chuyến đi"} · ${formatDateRange(start, end)}`;

  await db
    .update(trips)
    .set({
      lat,
      lng,
      startAt: start,
      endAt: end,
      city,
      provinceCode: province,
      country,
      coverPhotoId: earliest.coverPhotoId,
      title,
      updatedAt: new Date(),
    })
    .where(eq(trips.id, tripId));
}
