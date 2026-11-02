import { NextResponse } from "next/server";
import { auth, signIn } from "@/auth";
import { db } from "@/lib/db";
import { DEMO_TEAM, demoMode, switchToken } from "@/lib/demo";

/**
 * Role switch by page navigation (the profile menu links here). A full navigation cancels the old page's pending
 * requests, which would otherwise write the previous session cookie back over the new one.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const home = new URL("/", url);
  const session = await auth();
  const fetchSite = req.headers.get("sec-fetch-site");
  if (!session?.user || !demoMode() || (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none")) return NextResponse.redirect(home);

  const email = (url.searchParams.get("email") ?? "").toLowerCase();
  const admin = await db.user.findFirst({ where: { orgId: session.user.orgId, role: "Administrator", status: "Active" }, select: { email: true } });
  const allowed = new Set<string>([...DEMO_TEAM.map(p => p.email), ...(admin ? [admin.email] : [])]);
  const target = allowed.has(email) ? await db.user.findFirst({ where: { email, orgId: session.user.orgId, status: "Active" }, select: { email: true } }) : null;
  if (target) await signIn("demo-switch", { email: target.email, token: switchToken(target.email), redirect: false }).catch(() => undefined);
  return NextResponse.redirect(home);
}
