import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sha256 } from "@/lib/tokens";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import { notify } from "@/lib/notify";
import { charge, type Card } from "@/lib/payments";
import { balanceOf, round2, sumPayments, type LedgerEntry } from "@/lib/ledger";

async function find(token: string) {
  return db.publicLink.findUnique({ where: { tokenHash: sha256(token) } });
}

/**
 * What the customer owes on an invoice, read from the company's saved invoice ledger. The amount never comes from the
 * browser or from the link itself. Payments made through other links that the office has not applied yet are taken off,
 * so an invoice cannot be paid twice. Null when the invoice has not been saved to the ledger.
 */
async function historicEntry(orgId: string, ref: string): Promise<LedgerEntry | null> {
  const h = await db.workspaceEntity.findUnique({ where: { orgId_kind_key: { orgId, kind: "historicInvoices", key: ref } }, select: { json: true } });
  if (!h) return null;
  const inv = JSON.parse(h.json) as { amount: number; paid: number };
  return { number: ref, amount: inv.amount, payments: inv.paid > 0 ? [{ id: `legacy-${ref}`, amount: inv.paid, method: "Other", reference: "", at: 0, recordedBy: "Imported" }] : [], credits: [] };
}

async function invoiceDue(orgId: string, ref: string): Promise<{ balance: number; total: number; paid: number; void: boolean } | null> {
  const row = await db.workspaceEntity.findUnique({ where: { orgId_kind_key: { orgId, kind: "invoiceLedger", key: ref } }, select: { json: true } });
  // A sample-history invoice nobody has changed yet has no ledger entry: its stored opening position is what is owed.
  const entry: LedgerEntry | null = row ? JSON.parse(row.json) : await historicEntry(orgId, ref);
  if (!entry) return null;
  const links = await db.publicLink.findMany({ where: { orgId, kind: "invoice", ref, status: "paid" }, select: { id: true, paidAmount: true } });
  const unapplied = links.filter(l => !entry.payments.some(p => p.id === `link-${l.id}`)).reduce((s, l) => s + (l.paidAmount ?? 0), 0);
  return { balance: Math.max(0, round2(balanceOf(entry) - unapplied)), total: entry.amount, paid: round2(sumPayments(entry) + unapplied), void: !!entry.void };
}

/** What the customer sees. Nothing about other records or the organization beyond its name. */
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  if (!rateLimit(`link-get:${clientIp(req)}`, 60, 60_000)) return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  const link = await find((await params).token);
  if (!link || link.expiresAt < new Date() && link.status === "open") return NextResponse.json({ error: "This link is invalid or has expired." }, { status: 404 });
  const { email: _email, amount: _browserAmount, ...payload } = JSON.parse(link.payload);
  const due = link.kind === "invoice" ? await invoiceDue(link.orgId, link.ref) : undefined;
  const invoice = due === undefined ? {} : due === null ? { unavailable: true } : { amount: due.balance, total: due.total, paid: due.paid, void: due.void };
  return NextResponse.json({ kind: link.kind, ref: link.ref, status: link.status, chosenOption: link.chosenOption, signedName: link.signedName, signedAt: link.signedAt, ...payload, ...invoice });
}

type Body = { action?: string; option?: string; name?: string; rating?: number; comment?: string; card?: Card };

type Line = { qty: number; rate: number };
const lineSum = (lines: Line[]) => lines.reduce((t, l) => t + l.qty * l.rate, 0);
const cents = (n: number) => Math.round(n * 100) / 100;

/**
 * Customer actions. Estimates: approve (with a typed signature and optional chosen option) or decline.
 * Invoices: "pay" records a test-mode payment. No card processor is connected, so nothing is charged.
 */
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  if (!rateLimit(`link-post:${clientIp(req)}`, 20, 60_000)) return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  const link = await find((await params).token);
  if (!link || link.expiresAt < new Date()) return NextResponse.json({ error: "This link is invalid or has expired." }, { status: 404 });
  if (link.status !== "open") return NextResponse.json({ error: "This link has already been used." }, { status: 409 });
  const b = (await req.json().catch(() => ({}))) as Body;
  const payload = JSON.parse(link.payload);

  if (link.kind === "review") {
    const rating = Number(b.rating);
    if (b.action !== "review" || !Number.isInteger(rating) || rating < 1 || rating > 5) return NextResponse.json({ error: "Choose a rating from 1 to 5." }, { status: 400 });
    await db.review.create({ data: { orgId: link.orgId, ref: link.ref, customer: String(payload.customer ?? ""), rating, comment: (b.comment ?? "").slice(0, 1000) || null } });
    await db.publicLink.update({ where: { id: link.id }, data: { status: "approved", signedAt: new Date() } });
    return NextResponse.json({ ok: true });
  }

  if (link.kind === "estimate") {
    if (b.action === "decline") {
      await db.publicLink.update({ where: { id: link.id }, data: { status: "declined", signedAt: new Date() } });
    } else if (b.action === "approve") {
      const name = (b.name ?? "").trim();
      if (name.length < 2) return NextResponse.json({ error: "Type your full name to sign." }, { status: 400 });
      const options: { key: string }[] = payload.options ?? [];
      if (options.length && !options.some(o => o.key === b.option)) return NextResponse.json({ error: "Choose one of the options." }, { status: 400 });
      // A deposit, when the estimate asks for one, is charged to the test card as part of approving.
      const chosen = (payload.options as { key: string; lines: Line[] }[] | undefined)?.find(o => o.key === b.option);
      const total = lineSum(chosen?.lines ?? payload.lines ?? []) * (1 + Number(payload.taxPct ?? 0) / 100);
      const deposit = payload.depositPct ? cents(total * Number(payload.depositPct) / 100) : 0;
      let paidNote = "";
      if (deposit > 0) {
        if (!b.card) return NextResponse.json({ error: "Enter your card details to pay the deposit." }, { status: 400 });
        const result = charge(b.card, deposit);
        if (!result.ok) return NextResponse.json({ error: result.error }, { status: 402 });
        paidNote = ' Deposit ' + deposit + ' paid by ' + result.brand + ' ending ' + result.last4 + ' (test mode, ref ' + result.ref + ').';
      }
      await db.publicLink.update({ where: { id: link.id }, data: { status: "approved", signedName: name.slice(0, 120), signedAt: new Date(), chosenOption: options.length ? b.option : null, paidAmount: deposit > 0 ? deposit : null } });
      await notify(link.orgId, "email", "estimate.approved", "", 'Estimate ' + link.ref + ' approved', payload.customer + ' approved estimate ' + link.ref + '.' + paidNote);
      return NextResponse.json({ ok: true, deposit });
    } else return NextResponse.json({ error: "Unknown action." }, { status: 400 });
    await notify(link.orgId, "email", `estimate.${b.action}d`, "", `Estimate ${link.ref} ${b.action}d`, `${payload.customer} ${b.action}d estimate ${link.ref}.`);
    return NextResponse.json({ ok: true });
  }

  if (b.action !== "pay") return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  // The amount is the invoice's balance in the saved company data, never a figure from the browser.
  const due = await invoiceDue(link.orgId, link.ref);
  if (!due) return NextResponse.json({ error: "This invoice is not ready for payment yet. Please contact the company." }, { status: 409 });
  if (due.void) return NextResponse.json({ error: "This invoice has been cancelled." }, { status: 409 });
  const amount = cents(due.balance);
  if (!(amount > 0)) return NextResponse.json({ error: "Nothing is left to pay on this invoice." }, { status: 409 });
  if (!b.card) return NextResponse.json({ error: "Enter your card details." }, { status: 400 });
  const result = charge(b.card, amount);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 402 });
  await db.publicLink.update({ where: { id: link.id }, data: { status: "paid", paidAmount: amount, signedAt: new Date(), signedName: result.brand + ' ending ' + result.last4 } });
  await notify(link.orgId, "email", "invoice.paid", "", 'Invoice ' + link.ref + ' paid', payload.customer + ' paid ' + amount + ' on invoice ' + link.ref + ' with ' + result.brand + ' ending ' + result.last4 + ' (test mode, ref ' + result.ref + ').');
  return NextResponse.json({ ok: true });
}
