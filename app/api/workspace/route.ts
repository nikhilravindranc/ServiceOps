import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { OFFICE, requireUser } from "@/lib/api";

const MAX_BYTES = 8 * 1024 * 1024;
const BATCH = 400;

type Change = [kind: string, key: string, baseVersion: number, json: string];
type Delete = [kind: string, key: string, baseVersion: number];

/**
 * The organization's operational data, one row per record. A company that only has an older single-document snapshot
 * gets that document back as `legacyJson`; the browser then saves it record by record.
 */
export async function GET() {
  const r = await requireUser();
  if ("error" in r) return r.error;
  const [rows, org] = await Promise.all([
    db.workspaceEntity.findMany({ where: { orgId: r.user.orgId }, select: { kind: true, key: true, version: true, json: true } }),
    db.organization.findUnique({ where: { id: r.user.orgId }, select: { sampleData: true } }),
  ]);
  const legacy = rows.length ? null : await db.workspaceSnapshot.findUnique({ where: { orgId: r.user.orgId }, select: { json: true } });
  return NextResponse.json({
    rows: rows.map(x => [x.kind, x.key, x.version, x.json]),
    legacyJson: legacy?.json ?? null,
    sampleData: org?.sampleData ?? true,
    canWrite: OFFICE.includes(r.user.role),
  });
}

/**
 * Saves changed records. Each record carries the version the browser last saw: if someone else saved that record in the
 * meantime it is not overwritten, and their copy is returned so the browser can show it. Other records save normally.
 */
export async function PUT(req: Request) {
  const r = await requireUser(OFFICE);
  if ("error" in r) return r.error;
  const raw = await req.text();
  if (raw.length > MAX_BYTES) return NextResponse.json({ error: "Too much to save at once." }, { status: 413 });
  let body: { changes?: Change[]; deletes?: Delete[] };
  try { body = JSON.parse(raw); } catch { return NextResponse.json({ error: "Invalid save." }, { status: 400 }); }
  const changes = Array.isArray(body.changes) ? body.changes : [];
  const deletes = Array.isArray(body.deletes) ? body.deletes : [];
  if (![...changes, ...deletes].every(c => typeof c[0] === "string" && typeof c[1] === "string" && typeof c[2] === "number")) return NextResponse.json({ error: "Invalid save." }, { status: 400 });

  const orgId = r.user.orgId;
  const existing = new Map((await db.workspaceEntity.findMany({ where: { orgId }, select: { kind: true, key: true, version: true } })).map(x => [`${x.kind}\u0000${x.key}`, x.version]));
  const versions: [string, string, number][] = [];
  const conflicts: string[][] = [];
  const toCreate: { orgId: string; kind: string; key: string; json: string }[] = [];
  const updates: Change[] = [];
  const removals: Delete[] = [];

  for (const c of changes) {
    const cur = existing.get(`${c[0]}\u0000${c[1]}`) ?? 0;
    if (cur !== c[2]) conflicts.push([c[0], c[1]]);
    else if (cur === 0) toCreate.push({ orgId, kind: c[0], key: c[1], json: c[3] });
    else updates.push(c);
  }
  for (const d of deletes) {
    const cur = existing.get(`${d[0]}\u0000${d[1]}`) ?? 0;
    if (cur === 0) continue;
    if (cur !== d[2]) conflicts.push([d[0], d[1]]); else removals.push(d);
  }

  for (let i = 0; i < toCreate.length; i += BATCH) await db.workspaceEntity.createMany({ data: toCreate.slice(i, i + BATCH) });
  toCreate.forEach(c => versions.push([c.kind, c.key, 1]));
  for (const u of updates) {
    // The version in the where clause makes the save safe even if another save lands between our read and write.
    const res = await db.workspaceEntity.updateMany({ where: { orgId, kind: u[0], key: u[1], version: u[2] }, data: { json: u[3], version: u[2] + 1 } });
    if (res.count) versions.push([u[0], u[1], u[2] + 1]); else conflicts.push([u[0], u[1]]);
  }
  for (const d of removals) {
    const res = await db.workspaceEntity.deleteMany({ where: { orgId, kind: d[0], key: d[1], version: d[2] } });
    if (!res.count) conflicts.push([d[0], d[1]]);
  }

  // Hand back the current copy of every record that could not be saved (null = it was deleted).
  const theirs: [string, string, number, string | null][] = [];
  for (const [kind, key] of conflicts) {
    const row = await db.workspaceEntity.findUnique({ where: { orgId_kind_key: { orgId, kind, key } }, select: { version: true, json: true } });
    theirs.push([kind, key, row?.version ?? 0, row?.json ?? null]);
  }
  return NextResponse.json({ versions, conflicts: theirs });
}
