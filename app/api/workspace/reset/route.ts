import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ADMIN, audit, requireUser } from "@/lib/api";

/** Administrator only. Deletes the saved operational data and sets whether the next load starts with sample data or empty. */
export async function POST(req: Request) {
  const r = await requireUser(ADMIN);
  if ("error" in r) return r.error;
  const { mode } = await req.json().catch(() => ({}));
  if (mode !== "sample" && mode !== "empty") return NextResponse.json({ error: "Choose sample or empty." }, { status: 400 });
  await db.workspaceSnapshot.deleteMany({ where: { orgId: r.user.orgId } });
  await db.organization.update({ where: { id: r.user.orgId }, data: { sampleData: mode === "sample" } });
  await audit(r.user, "workspace.reset", "organization", r.user.orgId, { mode });
  return NextResponse.json({ ok: true });
}
