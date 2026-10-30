import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getPortalSession, loadSnapshot } from "@/lib/portalAuth";
import { newToken, sha256 } from "@/lib/tokens";
import { appUrl } from "@/lib/mail";
import { clientIp, rateLimit } from "@/lib/rateLimit";

const body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("estimate-link"), ref: z.string().max(40) }),
  z.object({ action: z.literal("invoice-link"), ref: z.string().max(40) }),
  z.object({ action: z.literal("request"), title: z.string().trim().min(3).max(160), description: z.string().trim().max(2000).optional(), serviceType: z.string().trim().min(1).max(40), site: z.string().trim().max(200).optional() }),
]);

/** Customer actions from the portal. Amounts always come from saved company data, never from the browser. */
export async function POST(req: Request) {
  if (!rateLimit(`portal-action:${clientIp(req)}`, 30, 60_000)) return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  const s = await getPortalSession();
  if (!s) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Check the details and try again." }, { status: 400 });
  const d = parsed.data;
  const [org, snap] = await Promise.all([db.organization.findUnique({ where: { id: s.orgId } }), loadSnapshot(s.orgId)]);
  const customer = (snap.customers ?? []).find(c => c.id === s.customerId);
  if (!org || !customer) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  if (d.action === "request") {
    const last = await db.request.findFirst({ where: { orgId: org.id }, orderBy: { number: "desc" }, select: { number: true } });
    const number = `REQ-${last ? Number(last.number.replace(/\D/g, "")) + 1 : 1001}`;
    await db.request.create({ data: { orgId: org.id, number, customerName: customer.name, contactName: customer.name, email: s.email, source: "Customer portal", serviceType: d.serviceType, title: d.title, description: d.description, site: d.site } });
    return NextResponse.json({ ok: true, number });
  }

  const token = newToken();
  const common = { orgId: org.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + 7 * 86_400_000) };
  if (d.action === "estimate-link") {
    const e = (snap.estimates ?? []).find(x => x.number === d.ref && x.customer === customer.name && x.status === "Sent");
    if (!e) return NextResponse.json({ error: "This estimate is not waiting for approval." }, { status: 404 });
    const wo = (snap.workOrders ?? []).find(w => w.id === e.woId);
    await db.publicLink.updateMany({ where: { orgId: org.id, kind: "estimate", ref: e.number, status: "open" }, data: { expiresAt: new Date() } });
    await db.publicLink.create({ data: { ...common, kind: "estimate", ref: e.number, payload: JSON.stringify({ customer: customer.name, title: wo?.title ?? e.number, taxPct: 18, lines: e.lines, options: e.options, depositPct: e.depositPct, company: org.name }) } });
    return NextResponse.json({ url: `${appUrl()}/approve/${token}` });
  }
  const inv = (snap.historicInvoices ?? []).find(x => x.number === d.ref && x.customer === customer.name);
  if (!inv || inv.amount - inv.paid <= 0) return NextResponse.json({ error: "Nothing is due on this invoice." }, { status: 404 });
  await db.publicLink.updateMany({ where: { orgId: org.id, kind: "invoice", ref: inv.number, status: "open" }, data: { expiresAt: new Date() } });
  await db.publicLink.create({ data: { ...common, kind: "invoice", ref: inv.number, payload: JSON.stringify({ customer: customer.name, title: `Invoice ${inv.number}`, amount: inv.amount - inv.paid, taxPct: 0, lines: [], company: org.name }) } });
  return NextResponse.json({ url: `${appUrl()}/pay/${token}` });
}
