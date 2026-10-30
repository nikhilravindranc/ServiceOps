import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { MANAGERS, OFFICE, audit, requireUser } from "@/lib/api";

const item = z.object({
  kind: z.enum(["service", "product"]),
  name: z.string().trim().min(2).max(120),
  sku: z.string().trim().max(40).optional(),
  unit: z.string().trim().min(1).max(20).default("each"),
  price: z.number().min(0).max(10_000_000),
  cost: z.number().min(0).max(10_000_000).default(0),
  taxable: z.boolean().default(true),
  serviceType: z.string().trim().max(40).optional(),
  description: z.string().trim().max(500).optional(),
});

export async function GET() {
  const r = await requireUser(OFFICE);
  if ("error" in r) return r.error;
  return NextResponse.json(await db.catalogItem.findMany({ where: { orgId: r.user.orgId }, orderBy: [{ kind: "asc" }, { name: "asc" }] }));
}

export async function POST(req: Request) {
  const r = await requireUser(MANAGERS);
  if ("error" in r) return r.error;
  const parsed = item.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a name and a price." }, { status: 400 });
  const row = await db.catalogItem.create({ data: { ...parsed.data, orgId: r.user.orgId } });
  await audit(r.user, "catalog.create", "catalog", row.id);
  return NextResponse.json(row, { status: 201 });
}
