import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { MANAGERS, requireUser } from "@/lib/api";

/** Total booked cost per job, for the Insights profit view. */
export async function GET() {
  const r = await requireUser(MANAGERS);
  if ("error" in r) return r.error;
  const rows = await db.jobCostEntry.findMany({ where: { orgId: r.user.orgId }, select: { jobId: true, qty: true, unitCost: true } });
  const byJob = new Map<number, number>();
  for (const e of rows) byJob.set(e.jobId, (byJob.get(e.jobId) ?? 0) + e.qty * e.unitCost);
  return NextResponse.json([...byJob].map(([jobId, cost]) => ({ jobId, cost })));
}
