import { sql } from "drizzle-orm";
import { db } from "@/db";
import { getConfig } from "./config";
import { resolveProvinceCode, resolveProvinceFromIso } from "./provinces";
import { pointProvince } from "./provincesGeo";

export interface GeoResult {
  country: string | null;
  city: string | null;
  placeName: string | null;
  provinceCode: string | null;
}

/** Grid cell key: round to 3 decimals (~110m) to dedupe nearby lookups. */
export function cellKey(coord: number): string {
  return coord.toFixed(3);
}

type FetchFn = typeof fetch;

export function parseNominatim(json: any): GeoResult {
  const addr = json?.address ?? {};
  const state: string | null = addr.state ?? addr.region ?? null;
  const city: string | null =
    addr.city ?? addr.town ?? addr.village ?? addr.county ?? addr.suburb ?? null;
  // Prefer an area/locality name over a specific POI/office name for the title.
  const placeName: string | null =
    addr.suburb || addr.neighbourhood || city || addr.road || json?.name || state || null;
  // ISO code first (reliable), then fall back to matching the state/city name.
  const provinceCode =
    resolveProvinceFromIso(addr["ISO3166-2-lvl4"]) ?? resolveProvinceCode(state ?? city);
  return {
    country: addr.country ?? null,
    city,
    placeName,
    provinceCode,
  };
}

/**
 * Reverse geocode lat/lng to admin names. Caches by grid cell in geocode_cache.
 * `fetchFn` and `now` injectable for tests.
 */
export async function reverseGeocode(
  lat: number,
  lng: number,
  fetchFn: FetchFn = fetch,
): Promise<GeoResult> {
  const config = getConfig();
  const latKey = cellKey(lat);
  const lngKey = cellKey(lng);

  const cached = await db.execute(
    sql`SELECT country, city, place_name, province_code FROM geocode_cache
        WHERE lat_key = ${latKey} AND lng_key = ${lngKey} LIMIT 1`,
  );
  const row = (cached as any).rows?.[0];
  if (row) {
    return {
      country: row.country,
      city: row.city,
      placeName: row.place_name,
      provinceCode: row.province_code,
    };
  }

  // Offline province (point-in-polygon) — always works, no network needed.
  const off = pointProvince(lat, lng);
  let result: GeoResult = off
    ? { country: "Việt Nam", city: off.name, placeName: off.name, provinceCode: off.code }
    : { country: null, city: null, placeName: null, provinceCode: null };

  // Best-effort finer names from Nominatim (short timeout); don't let it block/fail the result.
  const url = `${config.nominatimBaseUrl}/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=vi`;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetchFn(url, { headers: { "User-Agent": config.nominatimUserAgent }, signal: ctrl.signal });
    clearTimeout(t);
    if (res.ok) {
      const fine = parseNominatim(await res.json());
      result = {
        country: fine.country ?? result.country,
        city: fine.city ?? result.city,
        placeName: fine.placeName ?? result.placeName,
        provinceCode: fine.provinceCode ?? result.provinceCode, // prefer offline if Nominatim can't map
      };
    }
  } catch {
    // keep the offline result
  }

  await db.execute(
    sql`INSERT INTO geocode_cache (lat_key, lng_key, country, city, place_name, province_code)
        VALUES (${latKey}, ${lngKey}, ${result.country}, ${result.city}, ${result.placeName}, ${result.provinceCode})`,
  );

  return result;
}
