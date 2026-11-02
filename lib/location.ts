import { db } from "@/lib/db";

/**
 * Live location sharing rules, in one place.
 * Working hours (server local time): 08:00 to 18:00. Override for testing with LOCATION_HOURS="HH:MM-HH:MM"
 * (for example "00:00-24:00" to allow any time, or "03:00-03:01" to force "outside hours").
 */
export const DEFAULT_HOURS = "08:00-18:00";
/** Keep this many rows per technician; older ones are deleted on every write. */
export const KEEP_ROWS = 5;
/** Minimum gap between two accepted writes from one technician. */
export const MIN_WRITE_MS = 10_000;
/** Dispatch sees positions fresher than this. */
export const OFFICE_FRESH_MS = 15 * 60_000;
/** Customers only ever see a position fresher than this. */
export const CUSTOMER_FRESH_MS = 5 * 60_000;

const HOURS_RE = /^(\d{1,2}:\d{2})-(\d{1,2}:\d{2})$/;
const mins = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + (m || 0); };

export function workingHours() {
  const m = HOURS_RE.exec(process.env.LOCATION_HOURS ?? DEFAULT_HOURS) ?? HOURS_RE.exec(DEFAULT_HOURS)!;
  return { start: mins(m[1]), end: mins(m[2]) };
}
export function withinWorkingHours(now = new Date()) {
  const { start, end } = workingHours();
  const cur = now.getHours() * 60 + now.getMinutes();
  return cur >= start && cur < end;
}

/** True when the epoch-ms time falls on today's date in the given time zone. */
export function isToday(ms: number, tz: string, now = Date.now()) {
  try {
    const f = new Intl.DateTimeFormat("en-CA", { timeZone: tz || "UTC", year: "numeric", month: "2-digit", day: "2-digit" });
    return f.format(ms) === f.format(now);
  } catch { return false; }
}

/** Latest fresh position of each technician in the organization. */
export async function latestPositions(orgId: string, maxAgeMs: number) {
  const rows = await db.techLocation.findMany({ where: { orgId, at: { gte: new Date(Date.now() - maxAgeMs) } }, orderBy: { at: "desc" } });
  const seen = new Set<string>();
  return rows.filter(r => !seen.has(r.userId) && !!seen.add(r.userId));
}
