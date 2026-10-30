import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { MANAGERS, audit, requireUser } from "@/lib/api";

const entry = z.object({
  jobId: z.number().int().positive(),
  kind: z.enum(["labour", "part", "overhead", "other"]),
  label: z.string().trim().min(2).max(120),
  qty: z.number().positive().max(100000),
  unitCost: z.number().min(0).max(10_000_000),
});

export async function GET(req: Request) {
  const r = await requireUser(MANAGERS);
  if ("error" in r) return r.error;
  const jobId = Number(new URL(req.url).searchParams.get("jobId"));
  if (!Number.isInteger(jobId)) return NextResponse.json({ error: "jobId is required" }, { status: 400 });
  return NextResponse.json(await db.jobCostEntry.findMany({ where: { orgId: r.user.orgId, jobId }, orderBy: { createdAt: "asc" } }));
}

/** Accepts one entry, or an array (used by "Add parts from catalog"). */
export async function POST(req: Request) {
  const r = await requireUser(MANAGERS);
  if ("error" in r) return r.error;
  const body = await req.json().catch(() => null);
  const parsed = z.array(entry).min(1).max(50).safeParse(Array.isArray(body) ? body : [body]);
  if (!parsed.success) return NextResponse.json({ error: "Enter a description, a quantity and a unit cost." }, { status: 400 });
  await db.jobCostEntry.createMany({ data: parsed.data.map(e => ({ ...e, orgId: r.user.orgId })) });
  await audit(r.user, "jobcost.create", "job", String(parsed.data[0].jobId), { count: parsed.data.length });
  return NextResponse.json({ ok: true }, { status: 201 });
}
