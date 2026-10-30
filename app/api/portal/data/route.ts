import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getPortalSession, loadSnapshot } from "@/lib/portalAuth";

type Job = { id: number; status: string };
function woStatus(base: string, jobIds: number[], jobs: Job[]) {
  const mine = jobIds.map(id => jobs.find(j => j.id === id)).filter((j): j is Job => !!j);
  if (!mine.length) return base;
  if (mine.every(j => j.status === "Cancelled")) return "Cancelled";
  if (mine.every(j => ["Completed", "Cancelled"].includes(j.status))) return "Completed";
  if (mine.some(j => ["En route", "On site", "Incomplete"].includes(j.status))) return "In progress";
  return "Scheduled";
}

/** Everything the signed-in customer may see: their own work orders, estimates and invoices, and nothing else. */
export async function GET() {
  const s = await getPortalSession();
  if (!s) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const [org, snap] = await Promise.all([db.organization.findUnique({ where: { id: s.orgId } }), loadSnapshot(s.orgId)]);
  const customer = (snap.customers ?? []).find(c => c.id === s.customerId);
  if (!org || !customer) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const jobs = snap.jobs ?? [];
  const workOrders = (snap.workOrders ?? []).filter(w => w.customer === customer.name)
    .map(w => ({ number: w.number, title: w.title, status: woStatus(w.baseStatus, w.jobIds, jobs) })).slice(0, 50);
  const estimates = (snap.estimates ?? []).filter(e => e.customer === customer.name && e.status !== "Draft")
    .map(e => ({ number: e.number, status: e.status, total: Math.round((e.options?.length && e.status === "Sent" ? (e.options[1] ?? e.options[0]).lines : e.lines).reduce((t, l) => t + l.qty * l.rate, 0) * 1.18) }));
  const invoices = (snap.historicInvoices ?? []).filter(i => i.customer === customer.name)
    .map(i => ({ number: i.number, amount: i.amount, due: i.amount - i.paid, status: i.status })).slice(0, 50);
  const reviews = await db.review.count({ where: { orgId: s.orgId, customer: customer.name } });

  return NextResponse.json({ company: org.name, slug: org.slug, bookingEnabled: org.bookingEnabled, customer: { name: customer.name }, workOrders, estimates, invoices, reviewsGiven: reviews });
}
