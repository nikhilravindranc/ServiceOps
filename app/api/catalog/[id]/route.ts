import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { MANAGERS, audit, requireUser } from "@/lib/api";

const patch = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  sku: z.string().trim().max(40).optional(),
  unit: z.string().trim().min(1).max(20).optional(),
  price: z.number().min(0).max(10_000_000).optional(),
  cost: z.number().min(0).max(10_000_000).optional(),
  taxable: z.boolean().optional(),
  serviceType: z.string().trim().max(40).optional(),
  description: z.string().trim().max(500).optional(),
  active: z.boolean().optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const r = await requireUser(MANAGERS);
  if ("error" in r) return r.error;
  const { id } = await params;
  const parsed = patch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid change." }, { status: 400 });
  if (!(await db.catalogItem.findFirst({ where: { id, orgId: r.user.orgId } }))) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const row = await db.catalogItem.update({ where: { id }, data: parsed.data });
  await audit(r.user, "catalog.update", "catalog", id, parsed.data);
  return NextResponse.json(row);
}
