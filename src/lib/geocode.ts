import { sql } from "drizzle-orm";
import { db } from "@/db";
import { getConfig } from "./config";
import { resolveProvinceCode } from "./provinces";

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
  const placeName: string | null =
    json?.name || addr.tourism || addr.amenity || addr.neighbourhood || city || state || null;
  return {
    country: addr.country ?? null,
    city,
    placeName,
    provinceCode: resolveProvinceCode(state ?? city),
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

  const url = `${config.nominatimBaseUrl}/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=vi`;
  let result: GeoResult = { country: null, city: null, placeName: null, provinceCode: null };
  try {
    const res = await fetchFn(url, { headers: { "User-Agent": config.nominatimUserAgent } });
    if (res.ok) result = parseNominatim(await res.json());
  } catch {
    // leave as nulls; worker still stores coords
  }

  await db.execute(
    sql`INSERT INTO geocode_cache (lat_key, lng_key, country, city, place_name, province_code)
        VALUES (${latKey}, ${lngKey}, ${result.country}, ${result.city}, ${result.placeName}, ${result.provinceCode})`,
  );

  return result;
}
