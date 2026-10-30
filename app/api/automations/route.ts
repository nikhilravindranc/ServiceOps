import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { MANAGERS, OFFICE, audit, requireUser } from "@/lib/api";

const KEYS = ["quote.followup", "invoice.reminder", "request.autoarchive"] as const;
const DEFAULTS: Record<(typeof KEYS)[number], { enabled: boolean; afterDays: number }> = {
  "quote.followup": { enabled: false, afterDays: 3 },
  "invoice.reminder": { enabled: false, afterDays: 7 },
  "request.autoarchive": { enabled: false, afterDays: 14 },
};

export async function GET() {
  const r = await requireUser(OFFICE);
  if ("error" in r) return r.error;
  const rows = await db.automation.findMany({ where: { orgId: r.user.orgId } });
  return NextResponse.json(KEYS.map(key => {
    const row = rows.find(x => x.key === key);
    return { key, enabled: row?.enabled ?? DEFAULTS[key].enabled, afterDays: row?.afterDays ?? DEFAULTS[key].afterDays, lastRunAt: row?.lastRunAt ?? null };
  }));
}

const put = z.object({ key: z.enum(KEYS), enabled: z.boolean(), afterDays: z.number().int().min(1).max(90) });

export async function PUT(req: Request) {
  const r = await requireUser(MANAGERS);
  if ("error" in r) return r.error;
  const parsed = put.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid automation." }, { status: 400 });
  const { key, enabled, afterDays } = parsed.data;
  await db.automation.upsert({ where: { orgId_key: { orgId: r.user.orgId, key } }, create: { orgId: r.user.orgId, key, enabled, afterDays }, update: { enabled, afterDays } });
  await audit(r.user, "automation.update", "automation", key, { enabled, afterDays });
  return NextResponse.json({ ok: true });
}
