import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { issueToken, newCode } from "@/lib/tokens";
import { devLink, sendMail } from "@/lib/mail";
import { clientIp, rateLimit } from "@/lib/rateLimit";

/** Emails a 6-digit sign-in code. Same response whether or not the account exists. */
export async function POST(req: Request) {
  if (!rateLimit(`otp:${clientIp(req)}`, 5, 15 * 60_000)) return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  const { email } = await req.json().catch(() => ({}));
  const e = String(email ?? "").trim().toLowerCase();
  let code: string | undefined;
  const user = e ? await db.user.findUnique({ where: { email: e } }) : null;
  if (user && user.status !== "Deactivated") {
    const plain = newCode();
    await issueToken(e, "otp", 10, plain);
    const { delivered } = await sendMail(e, "Your ServiceOps sign-in code", `Your sign-in code is ${plain}. It works for 10 minutes.`);
    code = devLink(delivered, plain);
  }
  return NextResponse.json({ ok: true, devCode: code });
}
