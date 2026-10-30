import { db } from "@/lib/db";
import { MANAGERS, audit, requireUser } from "@/lib/api";

const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;

/** Payroll export: one row per person per day with hours worked. Only completed entries count. */
export async function GET(req: Request) {
  const r = await requireUser(MANAGERS);
  if ("error" in r) return r.error;
  const url = new URL(req.url);
  const from = new Date(url.searchParams.get("from") ?? Date.now() - 14 * 86_400_000);
  const to = new Date(url.searchParams.get("to") ?? Date.now() + 86_400_000);
  const rows = await db.timeEntry.findMany({ where: { orgId: r.user.orgId, clockIn: { gte: from, lte: to }, clockOut: { not: null } }, orderBy: [{ userName: "asc" }, { clockIn: "asc" }] });
  const byKey = new Map<string, { name: string; day: string; hours: number; flagged: boolean }>();
  for (const e of rows) {
    const day = e.clockIn.toISOString().slice(0, 10);
    const key = `${e.userId}|${day}`;
    const cur = byKey.get(key) ?? { name: e.userName, day, hours: 0, flagged: false };
    cur.hours += (e.clockOut!.getTime() - e.clockIn.getTime()) / 3_600_000;
    cur.flagged ||= e.outsideIn || e.outsideOut;
    byKey.set(key, cur);
  }
  const lines = ["Name,Date,Hours,Outside work area", ...[...byKey.values()].map(v => [esc(v.name), v.day, v.hours.toFixed(2), v.flagged ? "yes" : "no"].join(","))];
  await audit(r.user, "time.export", "time", undefined, { rows: byKey.size });
  return new Response(lines.join("\n") + "\n", { headers: { "Content-Type": "text/csv", "Content-Disposition": `attachment; filename="timesheets-${from.toISOString().slice(0, 10)}.csv"` } });
}
