import { readFileSync } from "node:fs";
import path from "node:path";

// Offline province lookup from the VN provinces GeoJSON (public/vn-provinces.geojson).
// This makes province + a region name resolve WITHOUT any network (Nominatim),
// so bulk imports never end up with "0 tỉnh thành" when the geocoder is rate-limited.

interface Ring {
  ring: number[][]; // [ [lng,lat], ... ]
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}
interface Prov {
  code: string;
  name: string;
  rings: Ring[]; // outer rings of each polygon
}

let CACHE: Prov[] | null = null;

function bbox(ring: number[][]): Ring {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const [x, y] of ring) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return { ring, minX, minY, maxX, maxY };
}

function load(): Prov[] {
  if (CACHE) return CACHE;
  try {
    const file = path.join(process.cwd(), "public", "vn-provinces.geojson");
    const geo = JSON.parse(readFileSync(file, "utf8"));
    const out: Prov[] = [];
    for (const f of geo.features ?? []) {
      const code = f.properties?.code;
      const name = f.properties?.name;
      if (!code) continue;
      const rings: Ring[] = [];
      const g = f.geometry;
      if (g?.type === "Polygon") {
        if (g.coordinates?.[0]) rings.push(bbox(g.coordinates[0]));
      } else if (g?.type === "MultiPolygon") {
        for (const poly of g.coordinates ?? []) if (poly?.[0]) rings.push(bbox(poly[0]));
      }
      if (rings.length) out.push({ code, name, rings });
    }
    CACHE = out;
  } catch (e) {
    console.error("provincesGeo load failed:", e instanceof Error ? e.message : e);
    CACHE = [];
  }
  return CACHE;
}

function inRing(x: number, y: number, r: Ring): boolean {
  if (x < r.minX || x > r.maxX || y < r.minY || y > r.maxY) return false;
  let inside = false;
  const ring = r.ring;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0],
      yi = ring[i][1],
      xj = ring[j][0],
      yj = ring[j][1];
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/** Which VN province contains this point? Returns {code,name} or null. */
export function pointProvince(lat: number, lng: number): { code: string; name: string } | null {
  for (const p of load()) {
    for (const r of p.rings) {
      if (inRing(lng, lat, r)) return { code: p.code, name: p.name };
    }
  }
  return null;
}
