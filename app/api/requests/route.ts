import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { OFFICE, audit, requireUser } from "@/lib/api";

const SOURCES = ["Phone", "Email", "Web form", "Online booking", "Customer portal", "Technician"] as const;
const create = z.object({
  customerName: z.string().trim().min(2).max(120),
  contactName: z.string().trim().max(120).optional(),
  email: z.string().trim().email().max(120).optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional(),
  source: z.enum(SOURCES).default("Phone"),
  serviceType: z.string().trim().min(1).max(40),
  priority: z.enum(["High", "Medium", "Low"]).default("Medium"),
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().max(4000).optional(),
  site: z.string().trim().max(200).optional(),
  campaign: z.string().trim().max(80).optional(),
});

export async function GET(req: Request) {
  const r = await requireUser(OFFICE);
  if ("error" in r) return r.error;
  const status = new URL(req.url).searchParams.get("status");
  const rows = await db.request.findMany({
    where: { orgId: r.user.orgId, ...(status ? { status } : {}) },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const r = await requireUser(OFFICE);
  if ("error" in r) return r.error;
  const parsed = create.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a customer, a short title and a service type." }, { status: 400 });

  const last = await db.request.findFirst({ where: { orgId: r.user.orgId }, orderBy: { number: "desc" }, select: { number: true } });
  const n = last ? Number(last.number.replace(/\D/g, "")) + 1 : 1001;
  const row = await db.request.create({ data: { ...parsed.data, orgId: r.user.orgId, number: `REQ-${n}`, createdById: r.user.id } });
  await audit(r.user, "request.create", "request", row.id);
  return NextResponse.json(row, { status: 201 });
}
