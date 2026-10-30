import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { issueToken } from "@/lib/tokens";
import { appUrl, devLink, sendMail } from "@/lib/mail";
import { clientIp, rateLimit } from "@/lib/rateLimit";

/** Always answers the same way so the form cannot be used to discover which emails have accounts. */
export async function POST(req: Request) {
  if (!rateLimit(`forgot:${clientIp(req)}`, 5, 15 * 60_000)) return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  const { email } = await req.json().catch(() => ({}));
  const e = String(email ?? "").trim().toLowerCase();
  let link: string | undefined;
  const user = e ? await db.user.findUnique({ where: { email: e } }) : null;
  if (user && user.status !== "Deactivated") {
    const token = await issueToken(e, "reset", 60);
    const url = `${appUrl()}/reset-password?email=${encodeURIComponent(e)}&token=${token}`;
    const { delivered } = await sendMail(e, "Reset your ServiceOps password", `Use this link to choose a new password:\n${url}\n\nIt works for one hour. If you did not ask for this, ignore this email.`);
    link = devLink(delivered, url);
  }
  return NextResponse.json({ ok: true, devLink: link });
}
