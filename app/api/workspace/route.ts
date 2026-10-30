import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { OFFICE, requireUser } from "@/lib/api";

const MAX_BYTES = 8 * 1024 * 1024;

/** The organization's saved operational data, plus whether a fresh workspace should start with sample data. */
export async function GET() {
  const r = await requireUser();
  if ("error" in r) return r.error;
  const [snap, org] = await Promise.all([
    db.workspaceSnapshot.findUnique({ where: { orgId: r.user.orgId } }),
    db.organization.findUnique({ where: { id: r.user.orgId }, select: { sampleData: true } }),
  ]);
  return NextResponse.json({ json: snap?.json ?? null, version: snap?.version ?? 0, sampleData: org?.sampleData ?? true, canWrite: OFFICE.includes(r.user.role) });
}

/** Saves a new snapshot. Rejects a save made from an out-of-date copy so two people cannot silently overwrite each other. */
export async function PUT(req: Request) {
  const r = await requireUser(OFFICE);
  if ("error" in r) return r.error;
  const body = await req.json().catch(() => null) as { json?: string; version?: number } | null;
  if (!body || typeof body.json !== "string" || typeof body.version !== "number") return NextResponse.json({ error: "Invalid snapshot." }, { status: 400 });
  if (body.json.length > MAX_BYTES) return NextResponse.json({ error: "Workspace is too large to save." }, { status: 413 });
  try { JSON.parse(body.json); } catch { return NextResponse.json({ error: "Invalid snapshot." }, { status: 400 }); }

  const current = await db.workspaceSnapshot.findUnique({ where: { orgId: r.user.orgId }, select: { version: true } });
  if ((current?.version ?? 0) !== body.version) return NextResponse.json({ error: "Changed by someone else.", version: current?.version ?? 0 }, { status: 409 });
  const next = body.version + 1;
  await db.workspaceSnapshot.upsert({
    where: { orgId: r.user.orgId },
    create: { orgId: r.user.orgId, json: body.json, version: next },
    update: { json: body.json, version: next },
  });
  return NextResponse.json({ version: next });
}
