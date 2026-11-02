import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { MANAGERS, requireUser } from "@/lib/api";

/** Who did what and when, newest first. Service managers and administrators only. Filter with ?entity=&entityId=&action=&limit= */
export async function GET(req: Request) {
  const r = await requireUser(MANAGERS);
  if ("error" in r) return r.error;
  const q = new URL(req.url).searchParams;
  const limit = Math.min(200, Math.max(1, Number(q.get("limit")) || 50));
  const rows = await db.auditLog.findMany({
    where: {
      orgId: r.user.orgId,
      ...(q.get("entity") ? { entity: q.get("entity")! } : {}),
      ...(q.get("entityId") ? { entityId: q.get("entityId")! } : {}),
      ...(q.get("action") ? { action: { startsWith: q.get("action")! } } : {}),
    },
    orderBy: { at: "desc" },
    take: limit,
  });
  const people = await db.user.findMany({ where: { orgId: r.user.orgId, id: { in: [...new Set(rows.map(x => x.userId).filter((x): x is string => !!x))] } }, select: { id: true, name: true, role: true } });
  return NextResponse.json(rows.map(x => {
    const who = people.find(p => p.id === x.userId);
    let meta: unknown = null;
    try { meta = x.meta ? JSON.parse(x.meta) : null; } catch { meta = x.meta; }
    return { id: x.id, at: x.at, action: x.action, entity: x.entity, entityId: x.entityId, by: who?.name ?? null, role: who?.role ?? null, meta };
  }));
}
