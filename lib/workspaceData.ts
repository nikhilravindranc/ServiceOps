import {
  CUSTOMERS, CONTACTS, ASSETS, SERVICE_HISTORY, WORK_ORDERS, ESTIMATES, PARTS, PART_REQUESTS, PART_RETURNS, HISTORIC_INVOICE_STORE,
  INVOICE_LEDGER, PAYMENT_SETTINGS,
} from "@/lib/serviceData";
import { ALL_JOBS, JOB_EXTRAS, CUSTOMER_DIRECTORY, WORKSPACE_STORE } from "@/lib/jobsData";

/**
 * The operational data (customers, work orders, jobs, estimates, assets, parts, invoices…) lives in module-level
 * collections that screens read synchronously. This file saves them to, and restores them from, one JSON snapshot
 * per organization. Restoring replaces the contents in place so every existing reference stays valid.
 */
const LISTS = {
  customers: CUSTOMERS, contacts: CONTACTS, assets: ASSETS, history: SERVICE_HISTORY, workOrders: WORK_ORDERS,
  estimates: ESTIMATES, parts: PARTS, partRequests: PART_REQUESTS, partReturns: PART_RETURNS, jobs: ALL_JOBS,
  historicInvoices: HISTORIC_INVOICE_STORE,
} as const;
// invoiceLedger: payments, credit notes and voids by invoice number. paymentSettings: the company's payment terms, deposit, staged billing and methods.
const MAPS = { jobExtras: JOB_EXTRAS, customerDirectory: CUSTOMER_DIRECTORY, workspaces: WORKSPACE_STORE, invoiceLedger: INVOICE_LEDGER, paymentSettings: PAYMENT_SETTINGS } as const;

type Snapshot = { [K in keyof typeof LISTS]?: unknown[] } & { [K in keyof typeof MAPS]?: Record<string, unknown> };

export const exportWorkspace = (): string => {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(LISTS)) out[k] = v;
  for (const [k, v] of Object.entries(MAPS)) out[k] = v;
  return JSON.stringify(out);
};

export function importWorkspace(json: string) {
  const snap = JSON.parse(json) as Snapshot;
  for (const [k, list] of Object.entries(LISTS)) {
    const incoming = snap[k as keyof typeof LISTS];
    if (Array.isArray(incoming)) (list as unknown[]).splice(0, list.length, ...incoming);
  }
  for (const [k, map] of Object.entries(MAPS)) {
    const incoming = snap[k as keyof typeof MAPS];
    if (incoming && typeof incoming === "object") {
      const target = map as Record<string, unknown>;
      for (const key of Object.keys(target)) delete target[key];
      Object.assign(target, incoming);
    }
  }
}

/** Empties every collection, for a workspace that starts without sample data. */
export function clearWorkspace() {
  for (const list of Object.values(LISTS)) (list as unknown[]).splice(0, list.length);
  for (const map of Object.values(MAPS)) for (const key of Object.keys(map)) delete (map as Record<string, unknown>)[key];
}

// ─────────────────────────────────────────────
//  Record-level storage: each record is saved on its own, so edits to different records never collide.
// ─────────────────────────────────────────────
/** Which field identifies a record in each list. Maps are keyed by their own keys. */
const LIST_KEY: Record<keyof typeof LISTS, string> = {
  customers: "id", contacts: "id", assets: "id", history: "id", workOrders: "id", estimates: "id", parts: "partNo",
  partRequests: "id", partReturns: "id", jobs: "id", historicInvoices: "number",
};
const SEP = "\u0000";
export const ORDER = "__order";
export const entityId = (kind: string, key: string) => `${kind}${SEP}${key}`;
export const splitEntityId = (id: string): [string, string] => { const i = id.indexOf(SEP); return [id.slice(0, i), id.slice(i + 1)]; };

/** Every record as its own JSON string, plus one order entry per list (so inserts and re-sorts survive). */
export function entityMap(): Map<string, string> {
  const out = new Map<string, string>();
  for (const [kind, list] of Object.entries(LISTS)) {
    const field = LIST_KEY[kind as keyof typeof LISTS];
    const keys: string[] = [];
    for (const item of list as unknown as Record<string, unknown>[]) {
      const key = String(item[field]);
      keys.push(key);
      out.set(entityId(kind, key), JSON.stringify(item));
    }
    out.set(entityId(ORDER, kind), JSON.stringify(keys));
  }
  for (const [kind, map] of Object.entries(MAPS)) for (const [key, v] of Object.entries(map)) out.set(entityId(kind, key), JSON.stringify(v));
  return out;
}

/** Replaces the in-memory data with the given saved records (in place, so existing references stay valid). */
export function importEntities(rows: [kind: string, key: string, json: string][]) {
  const byKind = new Map<string, Map<string, unknown>>();
  const orders = new Map<string, string[]>();
  for (const [kind, key, json] of rows) {
    if (kind === ORDER) { orders.set(key, JSON.parse(json)); continue; }
    if (!byKind.has(kind)) byKind.set(kind, new Map());
    byKind.get(kind)!.set(key, JSON.parse(json));
  }
  for (const [kind, list] of Object.entries(LISTS)) {
    const recs = byKind.get(kind) ?? new Map();
    const order = orders.get(kind) ?? [...recs.keys()];
    const arr = [...order.filter(k => recs.has(k)).map(k => recs.get(k)), ...[...recs.keys()].filter(k => !order.includes(k)).map(k => recs.get(k))];
    (list as unknown[]).splice(0, list.length, ...arr);
  }
  for (const [kind, map] of Object.entries(MAPS)) {
    const target = map as Record<string, unknown>;
    for (const key of Object.keys(target)) delete target[key];
    for (const [key, v] of byKind.get(kind) ?? []) target[key] = v;
  }
}

/** Applies one record that someone else saved (json null = they deleted it). */
export function applyEntity(kind: string, key: string, json: string | null) {
  if (kind === ORDER) {
    const list = LISTS[key as keyof typeof LISTS] as unknown as Record<string, unknown>[] | undefined;
    if (!list || json === null) return;
    const field = LIST_KEY[key as keyof typeof LISTS];
    const order: string[] = JSON.parse(json);
    const rank = new Map(order.map((k, i) => [k, i]));
    list.sort((a, b) => (rank.get(String(a[field])) ?? 1e9) - (rank.get(String(b[field])) ?? 1e9));
    return;
  }
  const list = LISTS[kind as keyof typeof LISTS] as unknown as Record<string, unknown>[] | undefined;
  if (list) {
    const field = LIST_KEY[kind as keyof typeof LISTS];
    const i = list.findIndex(x => String(x[field]) === key);
    if (json === null) { if (i >= 0) list.splice(i, 1); }
    else if (i >= 0) { const cur = list[i]; const next = JSON.parse(json) as Record<string, unknown>; for (const k of Object.keys(cur)) if (!(k in next)) delete cur[k]; Object.assign(cur, next); }
    else list.push(JSON.parse(json));
    return;
  }
  const map = MAPS[kind as keyof typeof MAPS] as Record<string, unknown> | undefined;
  if (map) { if (json === null) delete map[key]; else map[key] = JSON.parse(json); }
}
