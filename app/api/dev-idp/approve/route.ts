import { NextResponse } from "next/server";
import { mint, testIdpEnabled } from "@/lib/testIdp";

/** The "consent screen" of the test provider: issues a one-time code and sends the browser back to the app. */
export async function POST(req: Request) {
  if (!testIdpEnabled()) return NextResponse.json({ error: "Not available." }, { status: 404 });
  const { redirect_uri, state, email, name, client_id } = await req.json().catch(() => ({}));
  const e = String(email ?? "").trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(e)) return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
  let url: URL;
  try { url = new URL(String(redirect_uri)); } catch { return NextResponse.json({ error: "Bad redirect." }, { status: 400 }); }
  // Only ever send the browser back to this app's own sign-in callback.
  if (!/^\/api\/auth\/callback\/(google|microsoft-entra-id)$/.test(url.pathname) || url.host !== new URL(req.url).host) {
    return NextResponse.json({ error: "Redirect not allowed." }, { status: 400 });
  }
  url.searchParams.set("code", mint("code", e, String(name || e.split("@")[0]).slice(0, 80), String(client_id ?? ""), 5 * 60_000));
  if (state) url.searchParams.set("state", String(state));
  return NextResponse.json({ url: url.toString() });
}
