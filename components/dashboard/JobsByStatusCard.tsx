"use client";
import DashboardSection, { ViewAllLink } from "./DashboardSection";
import DonutWithLegend, { DonutSlice } from "./DonutWithLegend";

const byStatus: DonutSlice[] = [
  { label: "Yet to Start", value: 43, tone: "purple" },
  { label: "In Progress",  value: 12, tone: "blue" },
  { label: "Cancelled",    value: 0,  tone: "red" },
  { label: "Incomplete",   value: 1,  tone: "amber" },
  { label: "Completed",    value: 4,  tone: "green" },
];

export default function JobsByStatusCard() {
  return (
    <DashboardSection title="Job scheduled by status" headerRight={<ViewAllLink href="/jobs" label="View details" />}>
      <div className="sm:px-2">
        <DonutWithLegend data={byStatus} centerLabel="Total Jobs" unit="jobs" innerRadius="70%" />
      </div>
    </DashboardSection>
  );
}
