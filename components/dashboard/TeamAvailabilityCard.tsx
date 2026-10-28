"use client";
import DashboardSection, { ViewAllLink } from "./DashboardSection";
import DonutWithLegend, { DonutSlice } from "./DonutWithLegend";

const presence: DonutSlice[] = [
  { label: "Punched In",  value: 13,  tone: "green" },
  { label: "Punched Out", value: 5,   tone: "red" },
  { label: "Break",       value: 2,   tone: "amber" },
  { label: "Offline",     value: 159, tone: "gray" },
];

export default function TeamAvailabilityCard() {
  return (
    <DashboardSection title="Team availability" headerRight={<ViewAllLink href="/dispatch" />} className="flex flex-col">
      <div className="flex flex-1 items-center py-2">
        <DonutWithLegend data={presence} centerLabel="Total Users" unit="users" innerRadius="84%" />
      </div>
    </DashboardSection>
  );
}
