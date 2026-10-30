import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { MANAGERS, OFFICE, audit, requireUser } from "@/lib/api";

const body = z.object({
  technician: z.string().trim().min(2).max(80),
  name: z.string().trim().min(2).max(80),
  serviceType: z.string().trim().min(1).max(40),
  expiresOn: z.string().refine(s => !Number.isNaN(Date.parse(s)), "Invalid date"),
});

export async function GET() {
  const r = await requireUser(OFFICE);
  if ("error" in r) return r.error;
  return NextResponse.json(await db.certification.findMany({ where: { orgId: r.user.orgId }, orderBy: [{ technician: "asc" }, { expiresOn: "asc" }] }));
}

export async function POST(req: Request) {
  const r = await requireUser(MANAGERS);
  if ("error" in r) return r.error;
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter the technician, certification, service type and expiry date." }, { status: 400 });
  const row = await db.certification.create({ data: { ...parsed.data, expiresOn: new Date(parsed.data.expiresOn), orgId: r.user.orgId } });
  await audit(r.user, "certification.create", "certification", row.id);
  return NextResponse.json(row, { status: 201 });
}
