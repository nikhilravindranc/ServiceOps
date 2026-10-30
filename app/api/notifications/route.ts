import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { OFFICE, requireUser } from "@/lib/api";

/** Recent customer messages sent or recorded for this organization. */
export async function GET() {
  const r = await requireUser(OFFICE);
  if ("error" in r) return r.error;
  return NextResponse.json(await db.notificationLog.findMany({ where: { orgId: r.user.orgId }, orderBy: { at: "desc" }, take: 100 }));
}
