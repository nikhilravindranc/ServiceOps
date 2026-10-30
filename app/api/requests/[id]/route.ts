import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { OFFICE, audit, requireUser } from "@/lib/api";

const patch = z.object({
  status: z.enum(["New", "Reviewing", "Converted", "Declined"]).optional(),
  convertedTo: z.string().trim().max(80).optional(),
  priority: z.enum(["High", "Medium", "Low"]).optional(),
  title: z.string().trim().min(3).max(160).optional(),
  description: z.string().trim().max(4000).optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const r = await requireUser(OFFICE);
  if ("error" in r) return r.error;
  const { id } = await params;
  const parsed = patch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid change." }, { status: 400 });
  const existing = await db.request.findFirst({ where: { id, orgId: r.user.orgId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const row = await db.request.update({ where: { id }, data: parsed.data });
  await audit(r.user, "request.update", "request", id, parsed.data);
  return NextResponse.json(row);
}
