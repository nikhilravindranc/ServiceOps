import {
  CUSTOMERS, CONTACTS, ASSETS, SERVICE_HISTORY, WORK_ORDERS, ESTIMATES, PARTS, PART_REQUESTS, PART_RETURNS, HISTORIC_INVOICE_STORE,
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
const MAPS = { jobExtras: JOB_EXTRAS, customerDirectory: CUSTOMER_DIRECTORY, workspaces: WORKSPACE_STORE } as const;

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
