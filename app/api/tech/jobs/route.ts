import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/api";

/**
 * A light check for technicians: the saved job records (small, no photos), so the technician screen can tell when a job was reassigned,
 * cancelled or removed without downloading the whole workspace. With ?workspace=<job id> it also returns that one job's saved
 * workspace record, used to put the saved copy back after a job was taken away.
 */
export async function GET(req: Request) {
  const r = await requireUser(["Technician"]);
  if ("error" in r) return r.error;
  const orgId = r.user.orgId;
  const jobs = await db.workspaceEntity.findMany({ where: { orgId, kind: "jobs" }, select: { key: true, version: true, json: true } });
  const wsId = new URL(req.url).searchParams.get("workspace");
  const ws = wsId && /^\d{1,9}$/.test(wsId) ? await db.workspaceEntity.findUnique({ where: { orgId_kind_key: { orgId, kind: "workspaces", key: wsId } }, select: { key: true, version: true, json: true } }) : null;
  return NextResponse.json({
    jobs: jobs.map(j => [j.key, j.version, j.json]),
    workspace: wsId ? (ws ? [ws.key, ws.version, ws.json] : null) : undefined,
  });
}
