import { ASSETS, WORK_ORDERS, JOBS_TODAY_TS, DAY_MS, assetLastService, addWorkOrder, woStatus, customerByName, type Asset, type WorkOrder } from "@/lib/serviceData";

/**
 * Scheduled maintenance from service plans. Gold AMC visits each asset at its maintenance interval, Silver AMC at twice
 * that interval, and Pay per visit customers are never scheduled automatically.
 */
export const PLAN_FACTOR = { "Gold AMC": 1, "Silver AMC": 2 } as const;

export interface DueVisit { asset: Asset; plan: "Gold AMC" | "Silver AMC"; dueOn: number; daysLate: number; lastService: number | null; existing?: WorkOrder }

const isOpen = (w: WorkOrder) => !["Completed", "Cancelled"].includes(woStatus(w));

/** Assets on a plan whose next visit falls within `horizonDays` of today. `existing` is the open contract work order, if one was already raised. */
export function dueVisits(horizonDays: number): DueVisit[] {
  const out: DueVisit[] = [];
  for (const a of ASSETS) {
    const plan = customerByName(a.customer)?.plan ?? a.plan;
    if (plan !== "Gold AMC" && plan !== "Silver AMC") continue;
    const last = assetLastService(a);
    const dueOn = (last ?? a.installedOn) + a.pmIntervalDays * PLAN_FACTOR[plan] * DAY_MS;
    if (dueOn > JOBS_TODAY_TS + horizonDays * DAY_MS) continue;
    const existing = WORK_ORDERS.find(w => w.assetId === a.id && w.source === "Service contract" && isOpen(w));
    out.push({ asset: a, plan, dueOn, daysLate: Math.round((JOBS_TODAY_TS - dueOn) / DAY_MS), lastService: last, existing });
  }
  return out.sort((x, y) => x.dueOn - y.dueOn);
}

/** Raises one scheduled-maintenance work order per due asset that does not already have one. Returns the new work orders. */
export function generateMaintenance(visits: DueVisit[]): WorkOrder[] {
  const made: WorkOrder[] = [];
  for (const v of visits) {
    if (v.existing) continue;
    made.push(addWorkOrder({
      title: `Scheduled maintenance: ${v.asset.name}`, customer: v.asset.customer, serviceType: "Preventive", priority: "Medium",
      description: `${v.plan} visit for ${v.asset.name} (${v.asset.assetNo}). Raised automatically from the service plan.`,
      assetId: v.asset.id, preferredDate: v.dueOn, source: "Service contract", needsEstimate: false,
    }));
  }
  return made;
}
