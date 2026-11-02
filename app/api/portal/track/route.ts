import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getPortalSession, loadSnapshot } from "@/lib/portalAuth";
import { CUSTOMER_FRESH_MS, isToday } from "@/lib/location";
import { distanceKm, driveMinutes, positionFor } from "@/lib/geoData";

type SnapJob = { id: number; status: string; customer: string; region: string; technician: string; scheduledAt: number };
type SnapCustomer = { id: string; name: string; zone?: string; lat?: number; lng?: number };
const q = z.object({ job: z.coerce.number().int().positive() });
const NO_STORE = { "Cache-Control": "no-store" };

/**
 * Where the technician is, for one visit of the signed-in customer. A job that is not theirs is "not found".
 * A position is only returned when the company switch is on, the visit is today, the job is En route and the position is under 5 minutes old.
 */
export async function GET(req: Request) {
  const s = await getPortalSession();
  if (!s) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const parsed = q.safeParse({ job: new URL(req.url).searchParams.get("job") });
  if (!parsed.success) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const [org, snap] = await Promise.all([db.organization.findUnique({ where: { id: s.orgId }, select: { timezone: true, locationSharing: true } }), loadSnapshot(s.orgId)]);
  const customer = ((snap.customers ?? []) as SnapCustomer[]).find(c => c.id === s.customerId);
  if (!org || !customer) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const job = ((snap.jobs ?? []) as SnapJob[]).find(j => j.id === parsed.data.job);
  if (!job || job.customer !== customer.name) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const off = () => NextResponse.json({ available: false }, { headers: NO_STORE });
  if (!org.locationSharing || job.status !== "En route" || !isToday(job.scheduledAt, org.timezone)) return off();
  const pos = await db.techLocation.findFirst({ where: { orgId: s.orgId, jobId: job.id, at: { gte: new Date(Date.now() - CUSTOMER_FRESH_MS) } }, orderBy: { at: "desc" } });
  if (!pos) return off();

  const dest = positionFor(customer.name, job.region || customer.zone || "Central", customer);
  const km = distanceKm(pos, dest);
  return NextResponse.json({
    available: true,
    technician: pos.userName.trim().split(/\s+/)[0],
    km: Math.round(km * 10) / 10,
    etaMin: driveMinutes(km),
    updatedAt: pos.at.toISOString(),
    tech: { lat: pos.lat, lng: pos.lng },
    destination: { lat: dest.lat, lng: dest.lng, approximate: !dest.geocoded },
  }, { headers: NO_STORE });
}
