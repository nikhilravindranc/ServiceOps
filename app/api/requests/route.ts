import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { OFFICE, audit, requireUser } from "@/lib/api";
import { WORK_TYPES, missingDetails, type WorkType } from "@/lib/workTypes";

const SOURCES = ["Phone", "Email", "Web form", "Online booking", "Customer portal", "Technician"] as const;
const create = z.object({
  customerName: z.string().trim().min(2).max(120),
  contactName: z.string().trim().min(2, "Add a contact person.").max(120),
  email: z.string().trim().email().max(120).optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional(),
  source: z.enum(SOURCES).default("Phone"),
  serviceType: z.string().trim().min(1).max(40),
  workType: z.enum(WORK_TYPES).default("Service"),
  details: z.record(z.string(), z.string().max(1000)).default({}),
  preferredDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  priority: z.enum(["High", "Medium", "Low"]).default("Medium"),
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().max(4000).optional(),
  site: z.string().trim().min(3, "Add the site address.").max(200),
  campaign: z.string().trim().max(80).optional(),
}).refine(v => !!(v.phone || v.email), { message: "Add a phone number or an email.", path: ["phone"] });

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
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Enter a customer, contact, site and a short summary." }, { status: 400 });

  const missing = missingDetails(parsed.data.workType as WorkType, parsed.data.details);
  if (missing.length) return NextResponse.json({ error: `Please fill in: ${missing.join(", ")}.` }, { status: 400 });

  const last = await db.request.findFirst({ where: { orgId: r.user.orgId }, orderBy: { number: "desc" }, select: { number: true } });
  const n = last ? Number(last.number.replace(/\D/g, "")) + 1 : 1001;
  const { details, preferredDate, ...rest } = parsed.data;
  const row = await db.request.create({ data: { ...rest, details: JSON.stringify(details), preferredDate: preferredDate || null, orgId: r.user.orgId, number: `REQ-${n}`, createdById: r.user.id } });
  await audit(r.user, "request.create", "request", row.id);
  return NextResponse.json(row, { status: 201 });
}
