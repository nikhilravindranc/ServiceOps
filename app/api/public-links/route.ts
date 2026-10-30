import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { OFFICE, audit, requireUser } from "@/lib/api";
import { newToken, sha256 } from "@/lib/tokens";
import { appUrl } from "@/lib/mail";
import { notify } from "@/lib/notify";

const line = z.object({ item: z.string().max(160), qty: z.number(), rate: z.number() });
const body = z.object({
  kind: z.enum(["estimate", "invoice", "review"]),
  ref: z.string().trim().min(1).max(40),
  customer: z.string().trim().max(160),
  title: z.string().trim().max(200),
  email: z.string().trim().email().optional().or(z.literal("")),
  taxPct: z.number().min(0).max(100).default(18),
  lines: z.array(line).max(60).default([]),
  options: z.array(z.object({ key: z.string(), label: z.string().max(60), lines: z.array(line).max(60) })).max(3).optional(),
  depositPct: z.number().min(0).max(100).optional(),
  amount: z.number().min(0).optional(),
});

/** Creates a customer link for an estimate or an invoice and emails it when an address is known. */
export async function POST(req: Request) {
  const r = await requireUser(OFFICE);
  if ("error" in r) return r.error;
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Missing details for the link." }, { status: 400 });
  const d = parsed.data;

  // Only one live link per document: older ones stop working.
  await db.publicLink.updateMany({ where: { orgId: r.user.orgId, kind: d.kind, ref: d.ref, status: "open" }, data: { expiresAt: new Date() } });
  const token = newToken();
  const org = await db.organization.findUnique({ where: { id: r.user.orgId }, select: { name: true } });
  await db.publicLink.create({
    data: { orgId: r.user.orgId, kind: d.kind, ref: d.ref, tokenHash: sha256(token), expiresAt: new Date(Date.now() + 30 * 86_400_000), payload: JSON.stringify({ ...d, company: org?.name ?? "" }) },
  });
  const url = `${appUrl()}/${d.kind === "estimate" ? "approve" : d.kind === "invoice" ? "pay" : "review"}/${token}`;
  const subject = d.kind === "estimate" ? `Estimate ${d.ref} from ${org?.name}` : d.kind === "invoice" ? `Invoice ${d.ref} from ${org?.name}` : `How did we do? ${org?.name}`;
  const text = d.kind === "review" ? `Hello,

Thank you for choosing ${org?.name}. Please tell us how your visit (${d.title}) went. It takes a few seconds:
${url}` : d.kind === "estimate"
    ? `Hello,\n\nYour estimate ${d.ref} for "${d.title}" is ready. Review it and approve online:\n${url}\n\nThe link works for 30 days.`
    : `Hello,\n\nInvoice ${d.ref} is ready. You can pay it online:\n${url}`;
  const status = await notify(r.user.orgId, "email", `${d.kind}.sent`, d.email ?? "", subject, text);
  await audit(r.user, "link.create", d.kind, d.ref);
  return NextResponse.json({ url, emailed: status === "sent" });
}

/** Responses and payments made by customers, for the office app to apply to its records. */
export async function GET() {
  const r = await requireUser(OFFICE);
  if ("error" in r) return r.error;
  const rows = await db.publicLink.findMany({
    where: { orgId: r.user.orgId, status: { not: "open" } },
    select: { kind: true, ref: true, status: true, chosenOption: true, signedName: true, signedAt: true, paidAmount: true },
    orderBy: { createdAt: "desc" }, take: 200,
  });
  return NextResponse.json(rows);
}
