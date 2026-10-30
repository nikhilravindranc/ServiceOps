import { createHmac, timingSafeEqual } from "crypto";

/**
 * Test identity provider for local development. It imitates the OAuth flow of Google and Microsoft so the real
 * sign-in code can be exercised without client IDs. Anyone can sign in as any email, so it is OFF in production.
 * Real providers are used automatically when their client IDs are set in .env.
 */
export const testIdpEnabled = () => process.env.NODE_ENV !== "production";

const secret = () => process.env.AUTH_SECRET ?? "";
const sign = (body: string) => createHmac("sha256", secret()).update(body).digest("base64url");

type Claims = { email: string; name: string; client: string; exp: number; kind: "code" | "token" };

export function mint(kind: Claims["kind"], email: string, name: string, client: string, ttlMs: number) {
  const body = Buffer.from(JSON.stringify({ email, name, client, kind, exp: Date.now() + ttlMs } satisfies Claims)).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function read(token: string, kind: Claims["kind"]): Claims | null {
  const [body, sig] = token.split(".");
  if (!body || !sig || !secret()) return null;
  const expected = sign(body);
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const c = JSON.parse(Buffer.from(body, "base64url").toString()) as Claims;
    return c.kind === kind && c.exp > Date.now() ? c : null;
  } catch { return null; }
}

export const TEST_CLIENTS = { google: "test-google", "microsoft-entra-id": "test-microsoft" } as const;
export const baseUrl = () => process.env.APP_URL ?? "http://localhost:3100";
