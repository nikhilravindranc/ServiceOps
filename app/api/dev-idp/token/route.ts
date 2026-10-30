import { NextResponse } from "next/server";
import { mint, read, testIdpEnabled } from "@/lib/testIdp";

/** Token endpoint of the test provider: exchanges the one-time code for an access token. */
export async function POST(req: Request) {
  if (!testIdpEnabled()) return NextResponse.json({ error: "not_available" }, { status: 404 });
  const form = new URLSearchParams(await req.text());
  const claims = read(form.get("code") ?? "", "code");
  if (!claims) return NextResponse.json({ error: "invalid_grant" }, { status: 400 });
  const access = mint("token", claims.email, claims.name, claims.client, 60 * 60_000);
  return NextResponse.json({ access_token: access, token_type: "Bearer", expires_in: 3600, scope: "openid email profile" });
}
