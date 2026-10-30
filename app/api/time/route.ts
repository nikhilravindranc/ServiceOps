import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { MANAGERS, audit, requireUser } from "@/lib/api";
import { distanceM } from "@/lib/geo";

/** Entries in a date range (everyone's for managers, only your own otherwise), plus your open entry if you are clocked in. */
export async function GET(req: Request) {
  const r = await requireUser();
  if ("error" in r) return r.error;
  const url = new URL(req.url);
  const from = new Date(url.searchParams.get("from") ?? Date.now() - 7 * 86_400_000);
  const to = new Date(url.searchParams.get("to") ?? Date.now() + 86_400_000);
  const manager = MANAGERS.includes(r.user.role);
  const [entries, open, org] = await Promise.all([
    db.timeEntry.findMany({ where: { orgId: r.user.orgId, clockIn: { gte: from, lte: to }, ...(manager ? {} : { userId: r.user.id }) }, orderBy: { clockIn: "desc" }, take: 500 }),
    db.timeEntry.findFirst({ where: { orgId: r.user.orgId, userId: r.user.id, clockOut: null } }),
    db.organization.findUnique({ where: { id: r.user.orgId }, select: { geoLat: true, geoLng: true, geoRadiusM: true } }),
  ]);
  return NextResponse.json({ entries, open, manager, geofence: org?.geoLat != null && org.geoLng != null ? { lat: org.geoLat, lng: org.geoLng, radiusM: org.geoRadiusM ?? 200 } : null });
}

const body = z.object({ action: z.enum(["in", "out"]), lat: z.number().min(-90).max(90).optional(), lng: z.number().min(-180).max(180).optional(), note: z.string().trim().max(200).optional() });

export async function POST(req: Request) {
  const r = await requireUser();
  if ("error" in r) return r.error;
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const { action, lat, lng, note } = parsed.data;

  const org = await db.organization.findUnique({ where: { id: r.user.orgId }, select: { geoLat: true, geoLng: true, geoRadiusM: true } });
  const fenced = org?.geoLat != null && org.geoLng != null;
  const outside = fenced && lat != null && lng != null ? distanceM(org!.geoLat!, org!.geoLng!, lat, lng) > (org!.geoRadiusM ?? 200) : false;
  const open = await db.timeEntry.findFirst({ where: { orgId: r.user.orgId, userId: r.user.id, clockOut: null } });

  if (action === "in") {
    if (open) return NextResponse.json({ error: "You are already clocked in." }, { status: 409 });
    const row = await db.timeEntry.create({ data: { orgId: r.user.orgId, userId: r.user.id, userName: r.user.name ?? r.user.email ?? "User", clockIn: new Date(), inLat: lat, inLng: lng, outsideIn: outside, note } });
    await audit(r.user, "time.clockin", "time", row.id, { outside });
    return NextResponse.json({ entry: row, outside }, { status: 201 });
  }
  if (!open) return NextResponse.json({ error: "You are not clocked in." }, { status: 409 });
  const row = await db.timeEntry.update({ where: { id: open.id }, data: { clockOut: new Date(), outLat: lat, outLng: lng, outsideOut: outside, note: note ?? open.note } });
  await audit(r.user, "time.clockout", "time", row.id, { outside });
  return NextResponse.json({ entry: row, outside });
}
