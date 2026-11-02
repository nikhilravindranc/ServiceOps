import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { db } from "@/lib/db";

/** Customer portal sessions: a small signed cookie, separate from staff sign-in. */
const COOKIE = "portal_session";
const TTL_MS = 7 * 86_400_000;

export type PortalSession = { orgId: string; customerId: string; email: string; exp: number };

const secret = () => process.env.AUTH_SECRET ?? "";
const sign = (body: string) => createHmac("sha256", secret()).update(body).digest("base64url");

export async function startPortalSession(orgId: string, customerId: string, email: string) {
  const body = Buffer.from(JSON.stringify({ orgId, customerId, email, exp: Date.now() + TTL_MS } satisfies PortalSession)).toString("base64url");
  (await cookies()).set(COOKIE, `${body}.${sign(body)}`, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: TTL_MS / 1000 });
}

export async function endPortalSession() { (await cookies()).delete(COOKIE); }

export async function getPortalSession(): Promise<PortalSession | null> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw || !secret()) return null;
  const [body, sig] = raw.split(".");
  if (!body || !sig) return null;
  const expected = sign(body);
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const s = JSON.parse(Buffer.from(body, "base64url").toString()) as PortalSession;
    return s.exp > Date.now() ? s : null;
  } catch { return null; }
}

type Snap = {
  customers?: { id: string; name: string; email: string }[];
  contacts?: { customerId: string; email: string }[];
  workOrders?: { id: number; number: string; title: string; customer: string; baseStatus: string; requestedAt: number; jobIds: number[] }[];
  jobs?: { id: number; status: string }[];
  estimates?: { number: string; woId: number; customer: string; status: string; lines: { item: string; qty: number; rate: number }[]; options?: { key: string; label: string; lines: { item: string; qty: number; rate: number }[] }[]; depositPct?: number }[];
  historicInvoices?: { number: string; customer: string; amount: number; paid: number; status: string; dueOn: number }[];
};

const PORTAL_KINDS = ["customers", "contacts", "workOrders", "jobs", "estimates", "historicInvoices"] as const;

/** The company data the portal and public links read: the saved records, or an older single-document snapshot. */
export async function loadSnapshot(orgId: string): Promise<Snap> {
  const rows = await db.workspaceEntity.findMany({ where: { orgId, kind: { in: [...PORTAL_KINDS, "__order"] } }, select: { kind: true, key: true, json: true } });
  if (rows.length) {
    const out: Record<string, unknown[]> = {};
    const orders = new Map(rows.filter(r => r.kind === "__order").map(r => [r.key, JSON.parse(r.json) as string[]]));
    for (const kind of PORTAL_KINDS) {
      const recs = new Map(rows.filter(r => r.kind === kind).map(r => [r.key, JSON.parse(r.json)]));
      const order = orders.get(kind) ?? [...recs.keys()];
      out[kind] = [...order.filter(k => recs.has(k)).map(k => recs.get(k)), ...[...recs.keys()].filter(k => !order.includes(k)).map(k => recs.get(k))];
    }
    return out as Snap;
  }
  const row = await db.workspaceSnapshot.findUnique({ where: { orgId } });
  return row ? (JSON.parse(row.json) as Snap) : {};
}

/** Customers in this organization whose own or a contact's email matches. */
export async function customersForEmail(orgId: string, email: string) {
  const snap = await loadSnapshot(orgId);
  const e = email.trim().toLowerCase();
  const byContact = new Set((snap.contacts ?? []).filter(c => c.email?.toLowerCase() === e).map(c => c.customerId));
  return (snap.customers ?? []).filter(c => c.email?.toLowerCase() === e || byContact.has(c.id));
}
