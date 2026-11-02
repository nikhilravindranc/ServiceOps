import {
  ALL_JOBS, JOB_EXTRAS, CUSTOMER_DIRECTORY, createJob, getWorkspace, logActivity, updateJob, nowStamp,
  type JobRecord,
} from "@/lib/jobsData";
import { workOrderForJob, logWO } from "@/lib/serviceData";
import { CALL_OUT_FEE, DEFAULT_FOLLOW_UP, followUpCharges, followUpRebooks, type FollowUpAction } from "@/lib/fieldPolicy";

/** Visits the technician could not finish, where the office has not yet decided what happens next. */
export const needsFollowUp = (): JobRecord[] =>
  ALL_JOBS.filter(j => j.status === "Incomplete" && getWorkspace(j.id).outcome && !getWorkspace(j.id).outcome!.followUp)
    .sort((a, b) => a.scheduledAt - b.scheduledAt);

export const suggestedFollowUp = (job: JobRecord): FollowUpAction => DEFAULT_FOLLOW_UP[getWorkspace(job.id).outcome?.reason ?? "Other"];

/** Next working day at 09:00 as a datetime-local value, the default time for a rebooked visit. */
export function defaultRebookTime(from = new Date()): string {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 1, 9, 0);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/**
 * Records the office's decision on a visit that could not be finished.
 * - Rebook: creates a follow-up job (same customer, trade and technician) linked to the original, and to its work order.
 * - A call-out fee is recorded on the decision (the amount comes from lib/fieldPolicy.ts). Billing reads `outcome.followUp.fee`; nothing is invoiced here.
 * - Cancel: the job is cancelled.
 * Returns the follow-up job when one was created.
 */
export function resolveFollowUp(job: JobRecord, action: FollowUpAction, note: string, when: string, by: string): JobRecord | undefined {
  const ws = getWorkspace(job.id);
  if (!ws.outcome || ws.outcome.followUp) return undefined;
  const fee = followUpCharges(action) ? CALL_OUT_FEE : undefined;
  let created: JobRecord | undefined;

  if (followUpRebooks(action)) {
    const contact = CUSTOMER_DIRECTORY[job.customer];
    const extras = JOB_EXTRAS[job.id];
    created = createJob({
      customer: job.customer, address: contact?.address ?? "", email: contact?.email ?? "", city: "", phone: contact?.phone ?? "",
      state: "", pincode: "", region: job.region, serviceType: job.serviceType, priority: job.priority, status: "Scheduled",
      jobTitle: `Return visit · ${extras?.jobTitle || job.jobName}`,
      description: `Return visit for ${job.jobId}. Last visit not finished: ${ws.outcome.reason}${ws.outcome.note ? ` (${ws.outcome.note})` : ""}.${note ? ` ${note}` : ""}`,
      scheduleStart: when, scheduleEnd: when, technician: job.technician,
      productModel: extras?.productModel ?? "", serialNumber: extras?.serialNumber ?? "", notes: `Raised from ${job.jobId} after an unfinished visit.`,
    });
    getWorkspace(created.id).followUpOf = { jobId: job.id, jobRef: job.jobId };
    logActivity(created.id, `Return visit for ${job.jobId}${action === "Rebook free" ? " (no charge)" : " (call-out fee of the first visit applies)"}`);
    const wo = workOrderForJob(job.id);
    if (wo) { wo.jobIds.push(created.id); logWO(wo, `${created.jobId} booked as a return visit for ${job.jobId}`); }
  }
  if (action === "Cancel") updateJob(job.id, { status: "Cancelled" });

  ws.outcome.followUp = { action, note: note.trim(), at: nowStamp(), by, fee, newJobId: created?.id, newJobRef: created?.jobId };
  logActivity(job.id, `Follow-up decided by ${by}: ${action}${created ? ` (${created.jobId})` : ""}${note.trim() ? `. ${note.trim()}` : ""}`);
  return created;
}
