import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { MANAGERS, audit, requireUser } from "@/lib/api";

/**
 * Server-side rule: archive (decline) requests nobody has touched for N days. The estimate and invoice rules work on
 * the workspace data in the browser (lib/automations.ts), which calls this to record the run and get the archive result.
 */
export async function POST() {
  const r = await requireUser(MANAGERS);
  if ("error" in r) return r.error;
  const rule = await db.automation.findUnique({ where: { orgId_key: { orgId: r.user.orgId, key: "request.autoarchive" } } });
  let archived = 0;
  if (rule?.enabled) {
    const cutoff = new Date(Date.now() - rule.afterDays * 86_400_000);
    archived = (await db.request.updateMany({ where: { orgId: r.user.orgId, status: "New", createdAt: { lt: cutoff } }, data: { status: "Declined" } })).count;
    await db.automation.update({ where: { id: rule.id }, data: { lastRunAt: new Date() } });
  }
  const others = await db.automation.updateMany({ where: { orgId: r.user.orgId, key: { in: ["quote.followup", "invoice.reminder"] }, enabled: true }, data: { lastRunAt: new Date() } });
  await audit(r.user, "automation.run", "automation", undefined, { archived, others: others.count });
  return NextResponse.json({ archived });
}
