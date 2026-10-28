"use client";
import DashboardSection, { BarStat, Tone, ViewAllLink } from "./DashboardSection";

const quotations: { label: string; value: number; tone: Tone }[] = [
  { label: "Total",             value: 18, tone: "amber" },
  { label: "In Draft",          value: 2,  tone: "yellow" },
  { label: "Awaiting Response", value: 2,  tone: "purple" },
  { label: "Converted",         value: 3,  tone: "blue" },
];

export default function QuotationsCard() {
  return (
    <DashboardSection title="Quotations" headerRight={<ViewAllLink href="/billing" />}>
      <div className="grid grid-cols-4 gap-2">
        {quotations.map((q) => (
          <BarStat key={q.label} value={q.value} label={q.label} tone={q.tone} />
        ))}
      </div>
    </DashboardSection>
  );
}
