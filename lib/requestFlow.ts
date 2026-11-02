import {
  addWorkOrder, allInvoices, customerByName, estimateForWO, workOrderById, woJobs,
  type Estimate, type Invoice, type WOSource, type WorkOrder,
} from "@/lib/serviceData";
import type { JobPriority, JobRecord, ServiceType } from "@/lib/jobsData";
import { parseDetails, type WorkType } from "@/lib/workTypes";

/** A request as the API returns it. */
export type Req = {
  id: string; number: string; customerName: string; contactName: string | null; email: string | null; phone: string | null;
  source: string; serviceType: string; workType: WorkType; details: string | null; preferredDate: string | null;
  priority: JobPriority; title: string; description: string | null; site: string | null; campaign: string | null;
  status: "New" | "Reviewing" | "Converted" | "Declined"; convertedTo: string | null; createdAt: string;
};

// Work orders only know five intake channels; online and web requests count as portal.
export const WO_SOURCE: Record<string, WOSource> = {
  Phone: "Phone", Email: "Email", "Web form": "Customer portal", "Online booking": "Customer portal", "Customer portal": "Customer portal", Technician: "Technician",
};

/** Creates the work order for a request, carrying the request number, work type and answers across. */
export function workOrderFromRequest(r: Req, needsEstimate: boolean): WorkOrder {
  const cust = customerByName(r.customerName);
  const details = parseDetails(r.details);
  const wo = addWorkOrder({
    title: r.title, customer: r.customerName, contactId: undefined, serviceType: r.serviceType as ServiceType, priority: r.priority,
    description: [r.description, r.campaign ? `Campaign: ${r.campaign}` : "", `From request ${r.number}`].filter(Boolean).join("\n"),
    assetId: null, preferredDate: r.preferredDate ? new Date(`${r.preferredDate}T09:00`).getTime() : null,
    source: WO_SOURCE[r.source] ?? "Phone", needsEstimate, workType: r.workType, details, requestNumber: r.number,
  });
  if (!cust && r.site) wo.site = r.site;
  return wo;
}

export type Chain = { workOrder?: WorkOrder; estimate?: Estimate; jobs: JobRecord[]; invoices: Invoice[] };

/** Everything that grew out of a request: its work order, the estimate, the jobs and their invoices. */
export function chainForRequest(r: Pick<Req, "convertedTo">): Chain {
  const woId = Number((r.convertedTo ?? "").replace("work-order:", ""));
  const workOrder = Number.isFinite(woId) && woId ? workOrderById(woId) : undefined;
  if (!workOrder) return { jobs: [], invoices: [] };
  const jobs = woJobs(workOrder);
  const invoices = allInvoices().filter(i => i.woNumber === workOrder.number || jobs.some(j => j.id === i.jobId));
  return { workOrder, estimate: estimateForWO(workOrder.id), jobs, invoices };
}
