/**
 * Sample locations. The sample customers have no coordinates, so each one gets a stable position inside its service
 * zone around the New York area. Real addresses would come from geocoding once a map provider is connected.
 */
export const ZONE_CENTER: Record<string, { lat: number; lng: number }> = {
  North: { lat: 41.03, lng: -73.8 },
  South: { lat: 40.58, lng: -74.18 },
  East: { lat: 40.74, lng: -73.62 },
  West: { lat: 40.76, lng: -74.32 },
  Central: { lat: 40.73, lng: -73.99 },
};
export const DEPOT = { lat: 40.7306, lng: -73.9866, name: "Depot" };

/** Stable pseudo-random number in [0, 1) from text. */
function unit(text: string, salt: number): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 10000) / 10000;
}

export function placeFor(name: string, zone: string): { lat: number; lng: number } {
  const c = ZONE_CENTER[zone] ?? ZONE_CENTER.Central;
  return { lat: c.lat + (unit(name, 1) - 0.5) * 0.1, lng: c.lng + (unit(name, 2) - 0.5) * 0.12 };
}

/** Position of a customer: real geocoded coordinates when known, otherwise the stable approximate spot inside its zone. */
export function positionFor(name: string, zone: string, cust?: { lat?: number; lng?: number }): { lat: number; lng: number; geocoded: boolean } {
  if (cust?.lat != null && cust?.lng != null) return { lat: cust.lat, lng: cust.lng, geocoded: true };
  return { ...placeFor(name, zone), geocoded: false };
}

export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371, rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h)) * 1.3; // 1.3: roads are longer than straight lines
}

/** Drive time at an average 35 km/h in town, plus 4 minutes to park and walk in. */
export const driveMinutes = (km: number) => Math.round((km / 35) * 60) + 4;
