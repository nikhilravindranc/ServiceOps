import { ESTIMATES, allInvoices, customerByName, outstanding, workOrderById, logWO, DAY_MS } from "@/lib/serviceData";

export type AutomationRow = { key: "quote.followup" | "invoice.reminder" | "request.autoarchive"; enabled: boolean; afterDays: number; lastRunAt: string | null };
export type RunResult = { estimates: number; invoices: number; archived: number };

const post = (url: string, body: unknown) => fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

/**
 * Runs the follow-up rules. Estimate and invoice rules act on the workspace data held in the browser (and send through
 * the same customer-link endpoint as the buttons do); the request rule runs on the server.
 */
export async function runAutomations(): Promise<RunResult> {
  const res = await fetch("/api/automations").catch(() => null);
  const rules: AutomationRow[] = res?.ok ? await res.json() : [];
  const rule = (k: AutomationRow["key"]) => rules.find(r => r.key === k);
  const out: RunResult = { estimates: 0, invoices: 0, archived: 0 };
  const now = Date.now();

  const q = rule("quote.followup");
  if (q?.enabled) {
    for (const e of ESTIMATES) {
      if (e.status !== "Sent" || !e.sentAt || (e.followUps ?? 0) >= 2) continue;
      const since = e.sentAt + (e.followUps ?? 0) * q.afterDays * DAY_MS;
      if (now - since < q.afterDays * DAY_MS) continue;
      const wo = workOrderById(e.woId);
      const r = await post("/api/public-links", { kind: "estimate", ref: e.number, customer: e.customer, title: wo?.title ?? e.number, email: customerByName(e.customer)?.email ?? "", taxPct: 18, lines: e.lines, options: e.options, depositPct: e.depositPct });
      if (r.ok) { e.followUps = (e.followUps ?? 0) + 1; if (wo) logWO(wo, `Estimate ${e.number} follow-up sent automatically`); out.estimates++; }
    }
  }

  const i = rule("invoice.reminder");
  if (i?.enabled) {
    for (const inv of allInvoices()) {
      if (inv.status !== "Overdue") continue;
      const last = (inv as { remindedOn?: number }).remindedOn ?? 0;
      if (now - last < i.afterDays * DAY_MS) continue;
      const r = await post("/api/public-links", { kind: "invoice", ref: inv.number, customer: inv.customer, title: `Invoice ${inv.number}`, email: customerByName(inv.customer)?.email ?? "", taxPct: 0, lines: [], amount: outstanding(inv) });
      if (r.ok) { (inv as { remindedOn?: number }).remindedOn = now; out.invoices++; }
    }
  }

  const server = await post("/api/automations/run", {}).catch(() => null);
  if (server?.ok) out.archived = (await server.json()).archived ?? 0;
  return out;
}

