import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { OFFICE, audit, requireUser } from "@/lib/api";
import { rateLimit } from "@/lib/rateLimit";
import { KEEP_ROWS, MIN_WRITE_MS, OFFICE_FRESH_MS, latestPositions, withinWorkingHours, workingHours } from "@/lib/location";
import { loadSnapshot } from "@/lib/portalAuth";

const body = z.object({
  lat: z.number().finite().min(-90).max(90),
  lng: z.number().finite().min(-180).max(180),
  accuracy: z.number().finite().min(0).max(100_000).optional(),
  jobId: z.number().int().positive().optional(),
  optIn: z.literal(true),
});

/** Dispatch map: the latest position per technician, only when fresher than 15 minutes. Office roles only. */
export async function GET() {
  const r = await requireUser(OFFICE);
  if ("error" in r) return r.error;
  const org = await db.organization.findUnique({ where: { id: r.user.orgId }, select: { locationSharing: true } });
  if (!org?.locationSharing) return NextResponse.json({ enabled: false, positions: [] });
  const rows = await latestPositions(r.user.orgId, OFFICE_FRESH_MS);
  return NextResponse.json({ enabled: true, positions: rows.map(p => ({ userId: p.userId, name: p.userName, jobId: p.jobId, lat: p.lat, lng: p.lng, accuracy: p.accuracy, at: p.at.toISOString() })) }, { headers: { "Cache-Control": "no-store" } });
}

/** A technician who opted in reports their position. Refused when the company switch is off or outside working hours. */
export async function POST(req: Request) {
  const r = await requireUser(["Technician"]);
  if ("error" in r) return r.error;
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid position, or sharing was not switched on by you.", code: "invalid" }, { status: 400 });
  const { lat, lng, accuracy, jobId } = parsed.data;

  const org = await db.organization.findUnique({ where: { id: r.user.orgId }, select: { locationSharing: true } });
  if (!org?.locationSharing) return NextResponse.json({ error: "Location sharing is switched off for your company.", code: "disabled" }, { status: 403 });
  if (!withinWorkingHours()) {
    const h = workingHours(), f = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
    return NextResponse.json({ error: `Sharing only works during working hours (${f(h.start)} to ${f(h.end)}).`, code: "hours" }, { status: 403 });
  }
  if (!rateLimit(`loc:${r.user.id}`, 1, MIN_WRITE_MS)) return NextResponse.json({ error: "Too many updates.", code: "rate" }, { status: 429 });

  // Only attach a job that is really this technician's; otherwise share with dispatch only.
  let live: number | null = null;
  if (jobId != null) {
    const snap = await loadSnapshot(r.user.orgId);
    const job = (snap.jobs as { id: number; technician?: string }[] | undefined)?.find(j => j.id === jobId);
    if (job && job.technician?.trim().toLowerCase() === (r.user.name ?? "").trim().toLowerCase()) live = jobId;
  }

  const name = r.user.name ?? r.user.email ?? "Technician";
  const recent = await db.techLocation.findFirst({ where: { orgId: r.user.orgId, userId: r.user.id, at: { gte: new Date(Date.now() - OFFICE_FRESH_MS) } }, select: { id: true } });
  await db.techLocation.create({ data: { orgId: r.user.orgId, userId: r.user.id, userName: name, jobId: live, lat, lng, accuracy } });
  const old = await db.techLocation.findMany({ where: { orgId: r.user.orgId, userId: r.user.id }, orderBy: { at: "desc" }, skip: KEEP_ROWS, select: { id: true } });
  if (old.length) await db.techLocation.deleteMany({ where: { id: { in: old.map(o => o.id) } } });
  if (!recent) await audit(r.user, "location.start", "location", r.user.id, { jobId: live });
  return NextResponse.json({ ok: true, jobAttached: live != null });
}

/** Stop sharing: removes every stored position of this technician. */
export async function DELETE() {
  const r = await requireUser(["Technician"]);
  if ("error" in r) return r.error;
  const { count } = await db.techLocation.deleteMany({ where: { orgId: r.user.orgId, userId: r.user.id } });
  if (count) await audit(r.user, "location.stop", "location", r.user.id, { removed: count });
  return NextResponse.json({ ok: true, removed: count });
}
