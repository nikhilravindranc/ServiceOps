"use client";
import { Pill, type PillTone } from "@/components/ui/ServiceOpsUI";
import { STATUS_META, type JobStatus } from "@/lib/jobsData";
import { useTheme } from "@/components/ThemeContext";
import {
  woStatus, woJobs, assetById, type WorkOrder, type WOStatus, type EstimateStatus, type InvoiceStatus,
} from "@/lib/serviceData";

/* One hue per meaning, mirroring the Jobs palette: blue = booked/moving,
   green = done, amber = needs our action, gray = waiting on someone else,
   red = cancelled/overdue, purple = brand-new and unreviewed. */
export const WO_STATUS_TONE: Record<WOStatus, PillTone> = {
  "New": "purple",
  "Awaiting approval": "gray",
  "Ready to schedule": "amber",
  "Scheduled": "blue",
  "In progress": "blue",
  "Completed": "green",
  "Cancelled": "red",
};

export const ESTIMATE_TONE: Record<EstimateStatus, PillTone> = { Draft: "gray", Sent: "amber", Approved: "green", Declined: "red" };
export const INVOICE_TONE: Record<InvoiceStatus, PillTone> = { Draft: "gray", Sent: "blue", "Partially paid": "amber", Paid: "green", Overdue: "red" };

export function WOStatusPill({ wo }: { wo: WorkOrder }) {
  const s = woStatus(wo);
  return <Pill tone={WO_STATUS_TONE[s]}>{s}</Pill>;
}

/** Job status pill using the exact Jobs-list palette. */
export function JobStatusPill({ status }: { status: JobStatus }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const m = STATUS_META[status];
  const color = isDark ? m.dark : m.light;
  return (
    <span className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-badge-text font-medium whitespace-nowrap"
      style={{ backgroundColor: isDark ? m.bgDark : m.bgLight, color }}>
      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
      {status}
    </span>
  );
}

/** Everything a list row needs about a work order, resolved once. */
export function woSummary(wo: WorkOrder) {
  const jobs = woJobs(wo).sort((a, b) => b.scheduledAt - a.scheduledAt);
  const latest = jobs[0];
  return {
    status: woStatus(wo),
    latestJob: latest,
    technician: latest?.technician ?? null,
    scheduledAt: latest?.scheduledAt ?? null,
    asset: wo.assetId ? assetById(wo.assetId) : undefined,
  };
}
