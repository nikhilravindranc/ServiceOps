import { ESTIMATES, allInvoices, recordPayment, setEstimateStatus, workOrderById, logWO, type Estimate } from "@/lib/serviceData";

type LinkUpdate = { kind: "estimate" | "invoice"; ref: string; status: "approved" | "declined" | "paid"; chosenOption: string | null; signedName: string | null; signedAt: string | null; paidAmount: number | null };

/**
 * Applies what customers did through their links (approved or declined an estimate, paid an invoice) to the
 * office records. Safe to run repeatedly: only records that are not yet in the final state change.
 */
export async function applyLinkUpdates(): Promise<boolean> {
  const res = await fetch("/api/public-links").catch(() => null);
  if (!res?.ok) return false;
  const rows: LinkUpdate[] = await res.json();
  let changed = false;

  for (const r of rows) {
    if (r.kind === "estimate") {
      const est = ESTIMATES.find(e => e.number === r.ref);
      if (!est) continue;
      if (r.status === "approved" && est.status !== "Approved") {
        const opt = est.options?.find(o => o.key === r.chosenOption);
        if (opt) { est.chosenOption = opt.key; est.lines = opt.lines.map(l => ({ ...l })); }
        if (r.paidAmount) est.depositPaid = r.paidAmount;
        est.approval = { name: r.signedName ?? "Customer", at: r.signedAt ? Date.parse(r.signedAt) : Date.now(), via: "customer link" };
        setEstimateStatus(est, "Approved");
        const wo = workOrderById(est.woId);
        if (wo) logWO(wo, `Estimate ${est.number} approved by ${est.approval.name} through the customer link${opt ? ` (${opt.label})` : ""}`);
        changed = true;
      } else if (r.status === "declined" && est.status === "Sent") {
        setEstimateStatus(est, "Declined");
        const wo = workOrderById(est.woId);
        if (wo) logWO(wo, `Estimate ${est.number} declined by the customer`);
        changed = true;
      }
    } else if (r.status === "paid") {
      const inv = allInvoices().find(i => i.number === r.ref);
      if (inv && inv.status !== "Paid") { recordPayment(inv); changed = true; }
    }
  }
  return changed;
}

export type { Estimate };
