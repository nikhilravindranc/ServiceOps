import { DEPOT, distanceKm, driveMinutes } from "@/lib/geoData";

export type Stop = { id: number; label: string; lat: number; lng: number; start: number; durMs: number; status: string };

const MOVABLE = ["Yet to Start", "Scheduled"];
const MIN15 = 15 * 60_000;

/** Total distance of a route that starts at the depot and visits the stops in order. */
export function routeKm(order: Stop[]): number {
  let km = 0, here: { lat: number; lng: number } = DEPOT;
  for (const s of order) { km += distanceKm(here, s); here = s; }
  return km;
}
export const routeDriveMin = (order: Stop[]) => {
  let min = 0, here: { lat: number; lng: number } = DEPOT;
  for (const s of order) { min += driveMinutes(distanceKm(here, s)); here = s; }
  return min;
};

/** Always go to the nearest stop not yet visited. Simple and explainable; not guaranteed optimal. */
function nearestFirst(stops: Stop[]): Stop[] {
  const left = [...stops], out: Stop[] = [];
  let here: { lat: number; lng: number } = DEPOT;
  while (left.length) {
    let best = 0;
    for (let i = 1; i < left.length; i++) if (distanceKm(here, left[i]) < distanceKm(here, left[best])) best = i;
    const [next] = left.splice(best, 1);
    out.push(next); here = next;
  }
  return out;
}

export type RoutePlan = { order: Stop[]; before: number; after: number; savedKm: number; savedMin: number; times: { id: number; start: number }[]; reason: string };

/**
 * Suggests a better visiting order for one technician's day, using only visits that have not started (at least three).
 * Visits already under way or finished stay where they are; a suggestion is dropped if the new times would run into one.
 * New start times keep the first movable visit's time, then follow each visit's length plus the drive to the next,
 * rounded up to 15 minutes.
 */
export function planRoute(stops: Stop[]): RoutePlan | null {
  const movable = stops.filter(s => MOVABLE.includes(s.status));
  const fixed = stops.filter(s => !MOVABLE.includes(s.status));
  if (movable.length < 3) return null;
  const current = [...movable].sort((a, b) => a.start - b.start);
  const proposed = nearestFirst(current);
  const before = routeKm(current), after = routeKm(proposed);
  if (before - after < 0.5) return null;

  const times: { id: number; start: number }[] = [];
  let t = current[0].start, here: { lat: number; lng: number } = DEPOT;
  proposed.forEach((s, i) => {
    if (i > 0) t = Math.ceil((t + driveMinutes(distanceKm(here, s)) * 60_000) / MIN15) * MIN15;
    times.push({ id: s.id, start: t });
    t += s.durMs; here = s;
  });
  const clash = times.some((tm, i) => fixed.some(x => tm.start < x.start + x.durMs && tm.start + proposed[i].durMs > x.start));
  if (clash) return null;
  const savedKm = before - after;
  const savedMin = routeDriveMin(current) - routeDriveMin(proposed);
  const note = fixed.length ? ` ${fixed.length} visit${fixed.length === 1 ? "" : "s"} already under way stay${fixed.length === 1 ? "s" : ""} as booked.` : "";
  return {
    order: proposed, before, after, savedKm, savedMin, times,
    reason: `Visiting nearest first cuts the route from ${before.toFixed(1)} km to ${after.toFixed(1)} km, about ${Math.max(savedMin, 0)} minutes less driving.${note}`,
  };
}
