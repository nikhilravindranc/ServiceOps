import { db } from "@/lib/db";

/**
 * Address geocoding behind a small adapter. The default provider is OpenStreetMap Nominatim (free, no key).
 * Policy: identify ourselves with a User-Agent, at most one request per second, and never look up the same address twice
 * (results are stored in the GeoCache table). Failures are not cached, so an offline moment does not poison later lookups.
 * To use another provider, replace `lookup` below; everything else stays the same.
 */
export type GeoHit = { lat: number; lng: number; cached: boolean };

const UA = process.env.GEOCODE_USER_AGENT ?? "ServiceOps/1.0 (field-service app; contact: dmops@socialdnalabs.com)";
const ENDPOINT = process.env.GEOCODE_URL ?? "https://nominatim.openstreetmap.org/search";

/** Cache key: lower-cased, punctuation-light, single-spaced. */
export const normalizeAddress = (q: string) => q.toLowerCase().replace(/[^\p{L}\p{N}\s,#/-]/gu, " ").replace(/\s+/g, " ").trim();

// One outgoing request at a time, at least 1.1 s apart.
let chain: Promise<unknown> = Promise.resolve();
let lastCall = 0;
function throttled<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(async () => {
    const wait = lastCall + 1100 - Date.now();
    if (wait > 0) await new Promise(r => setTimeout(r, wait));
    lastCall = Date.now();
    return fn();
  });
  chain = run.catch(() => undefined);
  return run;
}

async function lookup(query: string): Promise<{ lat: number; lng: number } | null> {
  const url = `${ENDPOINT}?format=jsonv2&limit=1&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" }, signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`geocoder ${res.status}`);
  const rows = (await res.json()) as { lat: string; lon: string }[];
  const lat = Number(rows[0]?.lat), lng = Number(rows[0]?.lon);
  return rows.length && Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

/** Coordinates for an address, or null when it cannot be found or the service is unreachable. */
export async function geocodeAddress(address: string): Promise<GeoHit | null> {
  const query = normalizeAddress(address);
  if (query.length < 5) return null;
  const hit = await db.geoCache.findUnique({ where: { query } });
  if (hit) return { lat: hit.lat, lng: hit.lng, cached: true };
  try {
    const found = await throttled(() => lookup(query));
    if (!found) return null;
    await db.geoCache.upsert({ where: { query }, create: { query, ...found }, update: found });
    return { ...found, cached: false };
  } catch {
    return null;
  }
}
