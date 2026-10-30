import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { consumeToken } from "@/lib/tokens";

export async function POST(req: Request) {
  const { email, token } = await req.json().catch(() => ({}));
  const e = String(email ?? "").trim().toLowerCase();
  if (!e || !token || !(await consumeToken(e, "verify", String(token)))) return NextResponse.json({ error: "This link is invalid or has expired." }, { status: 400 });
  await db.user.update({ where: { email: e }, data: { emailVerifiedAt: new Date() } });
  return NextResponse.json({ ok: true });
}
