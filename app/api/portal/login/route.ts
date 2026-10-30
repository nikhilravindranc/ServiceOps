import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { issueToken, newCode } from "@/lib/tokens";
import { customersForEmail } from "@/lib/portalAuth";
import { devLink } from "@/lib/mail";
import { notify } from "@/lib/notify";
import { clientIp, rateLimit } from "@/lib/rateLimit";

/** Emails a 6-digit code to a customer. The answer is the same whether or not the email is known. */
export async function POST(req: Request) {
  if (!rateLimit(`portal-login:${clientIp(req)}`, 5, 15 * 60_000)) return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  const { slug, email } = await req.json().catch(() => ({}));
  const e = String(email ?? "").trim().toLowerCase();
  const org = slug ? await db.organization.findUnique({ where: { slug: String(slug) } }) : null;
  let devCode: string | undefined;
  if (org && /^\S+@\S+\.\S+$/.test(e) && (await customersForEmail(org.id, e)).length) {
    const code = newCode();
    await issueToken(`${org.id}|${e}`, "portal", 10, code);
    const status = await notify(org.id, "email", "portal.code", e, `Your ${org.name} sign-in code`, `Your sign-in code is ${code}. It works for 10 minutes.`);
    devCode = devLink(status === "sent", code);
  }
  return NextResponse.json({ ok: true, devCode });
}
