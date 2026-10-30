import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import { notify } from "@/lib/notify";

async function orgFor(slug: string) {
  const org = await db.organization.findUnique({ where: { slug } });
  return org && org.bookingEnabled ? org : null;
}

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (!rateLimit(`book-get:${clientIp(req)}`, 60, 60_000)) return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  const org = await orgFor((await params).slug);
  if (!org) return NextResponse.json({ error: "Online booking is not available." }, { status: 404 });
  return NextResponse.json({ company: org.name, serviceTypes: JSON.parse(org.serviceTypes) as string[], arrivalWindowMins: org.arrivalWindowMins });
}

const form = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(120),
  phone: z.string().trim().max(40).optional(),
  address: z.string().trim().min(3).max(200),
  serviceType: z.string().trim().min(1).max(40),
  description: z.string().trim().min(3).max(2000),
  preferred: z.string().trim().max(60).optional(),
  ref: z.string().trim().max(120).optional(), // who referred this customer
  website: z.string().max(0).optional(), // honeypot: real people leave it empty
});

/** A customer's online booking becomes a Request (source "Online booking") for the office to verify. */
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (!rateLimit(`book-post:${clientIp(req)}`, 5, 15 * 60_000)) return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });
  const org = await orgFor((await params).slug);
  if (!org) return NextResponse.json({ error: "Online booking is not available." }, { status: 404 });
  const parsed = form.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Please fill in your name, email, address and what you need." }, { status: 400 });
  const d = parsed.data;

  const types: string[] = JSON.parse(org.serviceTypes);
  const serviceType = types.length === 0 || types.includes(d.serviceType) ? d.serviceType : types[0];
  const last = await db.request.findFirst({ where: { orgId: org.id }, orderBy: { number: "desc" }, select: { number: true } });
  const number = `REQ-${last ? Number(last.number.replace(/\D/g, "")) + 1 : 1001}`;
  await db.request.create({
    data: {
      orgId: org.id, number, customerName: d.name, contactName: d.name, email: d.email, phone: d.phone, source: "Online booking", serviceType, priority: "Medium",
      title: `${serviceType} service request`, description: [d.description, d.preferred ? `Preferred time: ${d.preferred}` : ""].filter(Boolean).join("\n"), site: d.address, campaign: d.ref ? `Referral: ${d.ref}` : undefined,
    },
  });
  await notify(org.id, "email", "request.received", d.email, `We received your request (${number})`,
    `Hello ${d.name},\n\n${org.name} has received your service request ${number}. We will confirm a time shortly. Arrival windows are about ${org.arrivalWindowMins / 60} hours.`);
  return NextResponse.json({ ok: true, number });
}
