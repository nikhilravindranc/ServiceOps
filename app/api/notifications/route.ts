import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { OFFICE, requireUser } from "@/lib/api";
import { raiseUnsafe } from "@/lib/techApi";

/** Recent customer messages sent or recorded for this organization. */
export async function GET() {
  const r = await requireUser(OFFICE);
  if ("error" in r) return r.error;
  return NextResponse.json(await db.notificationLog.findMany({ where: { orgId: r.user.orgId }, orderBy: { at: "desc" }, take: 100 }));
}

/** A technician raising "stop work, unsafe" on one of their own jobs. The only thing anyone may post here. */
export async function POST(req: Request) {
  const r = await requireUser(["Technician"]);
  if ("error" in r) return r.error;
  const out = await raiseUnsafe(r.user, await req.json().catch(() => null));
  return NextResponse.json(out.json, { status: out.status });
}
