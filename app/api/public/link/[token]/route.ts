import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sha256 } from "@/lib/tokens";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import { notify } from "@/lib/notify";
import { charge, type Card } from "@/lib/payments";

async function find(token: string) {
  return db.publicLink.findUnique({ where: { tokenHash: sha256(token) } });
}

/** What the customer sees. Nothing about other records or the organization beyond its name. */
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  if (!rateLimit(`link-get:${clientIp(req)}`, 60, 60_000)) return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  const link = await find((await params).token);
  if (!link || link.expiresAt < new Date() && link.status === "open") return NextResponse.json({ error: "This link is invalid or has expired." }, { status: 404 });
  const { email: _email, ...payload } = JSON.parse(link.payload);
  return NextResponse.json({ kind: link.kind, ref: link.ref, status: link.status, chosenOption: link.chosenOption, signedName: link.signedName, signedAt: link.signedAt, ...payload });
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
  const amount = cents(Number(payload.amount ?? 0));
  if (!b.card) return NextResponse.json({ error: "Enter your card details." }, { status: 400 });
  const result = charge(b.card, amount);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 402 });
  await db.publicLink.update({ where: { id: link.id }, data: { status: "paid", paidAmount: amount, signedAt: new Date(), signedName: result.brand + ' ending ' + result.last4 } });
  await notify(link.orgId, "email", "invoice.paid", "", 'Invoice ' + link.ref + ' paid', payload.customer + ' paid ' + amount + ' on invoice ' + link.ref + ' with ' + result.brand + ' ending ' + result.last4 + ' (test mode, ref ' + result.ref + ').');
  return NextResponse.json({ ok: true });
}
