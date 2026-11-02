import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { OFFICE, audit, requireUser } from "@/lib/api";

const patch = z.object({
  status: z.enum(["New", "Reviewing", "Converted", "Declined"]).optional(),
  convertedTo: z.string().trim().max(80).optional(),
  priority: z.enum(["High", "Medium", "Low"]).optional(),
  title: z.string().trim().min(3).max(160).optional(),
  description: z.string().trim().max(4000).optional(),
  declineReason: z.string().trim().max(300).optional(),
});

/** A request is addressed by its id or its number (REQ-1001). */
const find = (orgId: string, key: string) => db.request.findFirst({ where: { orgId, OR: [{ id: key }, { number: key }] } });

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const r = await requireUser(OFFICE);
  if ("error" in r) return r.error;
  const row = await find(r.user.orgId, (await params).id);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const events = await db.auditLog.findMany({ where: { orgId: r.user.orgId, entity: "request", entityId: row.id }, orderBy: { at: "asc" }, take: 100 });
  const people = await db.user.findMany({ where: { orgId: r.user.orgId, id: { in: [row.createdById, ...events.map(e => e.userId)].filter((x): x is string => !!x) } }, select: { id: true, name: true } });
  const nameOf = (id: string | null) => people.find(p => p.id === id)?.name ?? null;
  return NextResponse.json({
    ...row, createdBy: nameOf(row.createdById),
    timeline: events.map(e => ({ action: e.action, at: e.at, by: nameOf(e.userId), meta: e.meta ? JSON.parse(e.meta) : null })),
  });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const r = await requireUser(OFFICE);
  if ("error" in r) return r.error;
  const parsed = patch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid change." }, { status: 400 });
  const existing = await find(r.user.orgId, (await params).id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { declineReason, ...data } = parsed.data;
  if (data.status === "Declined" && !declineReason) return NextResponse.json({ error: "Give a reason for declining." }, { status: 400 });
  const row = await db.request.update({ where: { id: existing.id }, data });
  await audit(r.user, "request.update", "request", existing.id, { ...data, ...(declineReason ? { declineReason } : {}), from: existing.status });
  return NextResponse.json(row);
}
