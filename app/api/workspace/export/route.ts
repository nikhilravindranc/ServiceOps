import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ADMIN, audit, requireUser } from "@/lib/api";

/** A complete copy of the company's data for backup or migration: every saved record plus the people (without passwords). Administrators only. */
export async function GET() {
  const r = await requireUser(ADMIN);
  if ("error" in r) return r.error;
  const orgId = r.user.orgId;
  const [org, records, users, requests, catalog] = await Promise.all([
    db.organization.findUnique({ where: { id: orgId } }),
    db.workspaceEntity.findMany({ where: { orgId }, select: { kind: true, key: true, version: true, json: true } }),
    db.user.findMany({ where: { orgId }, select: { id: true, name: true, email: true, role: true, status: true, createdAt: true } }),
    db.request.findMany({ where: { orgId } }),
    db.catalogItem.findMany({ where: { orgId } }),
  ]);
  await audit(r.user, "workspace.export", "organization", orgId, { records: records.length });
  const body = JSON.stringify({ exportedAt: new Date().toISOString(), format: 1, organization: org, users, requests, catalog, records }, null, 1);
  return new NextResponse(body, { headers: {
    "Content-Type": "application/json",
    "Content-Disposition": `attachment; filename="serviceops-backup-${new Date().toISOString().slice(0, 10)}.json"`,
    "Cache-Control": "no-store",
  } });
}
