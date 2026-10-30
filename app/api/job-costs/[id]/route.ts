import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { MANAGERS, audit, requireUser } from "@/lib/api";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const r = await requireUser(MANAGERS);
  if ("error" in r) return r.error;
  const { id } = await params;
  const { count } = await db.jobCostEntry.deleteMany({ where: { id, orgId: r.user.orgId } });
  if (!count) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await audit(r.user, "jobcost.delete", "jobcost", id);
  return NextResponse.json({ ok: true });
}
