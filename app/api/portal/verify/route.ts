import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { consumeToken } from "@/lib/tokens";
import { customersForEmail, startPortalSession } from "@/lib/portalAuth";
import { clientIp, rateLimit } from "@/lib/rateLimit";

export async function POST(req: Request) {
  if (!rateLimit(`portal-verify:${clientIp(req)}`, 10, 15 * 60_000)) return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  const { slug, email, code } = await req.json().catch(() => ({}));
  const e = String(email ?? "").trim().toLowerCase();
  const org = slug ? await db.organization.findUnique({ where: { slug: String(slug) } }) : null;
  if (!org || !(await consumeToken(`${org.id}|${e}`, "portal", String(code ?? "")))) return NextResponse.json({ error: "That code is wrong or has expired." }, { status: 400 });
  const customers = await customersForEmail(org.id, e);
  if (!customers.length) return NextResponse.json({ error: "No customer account matches this email." }, { status: 404 });
  await startPortalSession(org.id, customers[0].id, e);
  return NextResponse.json({ ok: true });
}
