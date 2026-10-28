"use client";
import Tooltip from "@mui/material/Tooltip";
import DashboardSection, { ChevronLink, TONES, Tone } from "./DashboardSection";

const fmt = (n: number) => `$${n.toLocaleString("en-US")}`;

const collections: { label: string; value: number; tone: Tone }[] = [
  { label: "Pending Payments", value: 50000, tone: "indigo" },
  { label: "Partially Paid",   value: 30000, tone: "amber" },
  { label: "Paid",             value: 59000, tone: "green" },
];

const risks: { label: string; value: number; tone: Tone }[] = [
  { label: "Overdue",  value: 4590, tone: "yellow" },
  { label: "Bad Debt", value: 340,  tone: "red" },
];

export default function InvoicesCard() {
  return (
    <DashboardSection title="Invoices" headerRight={<ChevronLink href="/billing" label="View invoices" />}>
      {/* Collection status — one segmented bar, labelled underneath */}
      <div className="flex h-2.5 w-full overflow-hidden rounded-full">
        {collections.map((c) => (
          <Tooltip key={c.label} title={`${c.label}: ${fmt(c.value)}`} arrow>
            <span className="h-full" style={{ flex: c.value, backgroundColor: TONES[c.tone].fg }} />
          </Tooltip>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {collections.map((c, i) => (
          <div key={c.label} className={i === 1 ? "text-center" : i === 2 ? "text-right" : ""}>
            <p className="m-0 text-h2 font-bold text-[var(--text-primary)]">{fmt(c.value)}</p>
            <p className={`m-0 text-card-metadata text-[var(--text-muted)] ${i === 2 ? "inline-flex items-center gap-1.5" : ""}`}>
              {i === 2 && <span className="w-2 h-2 rounded-full" style={{ backgroundColor: TONES[c.tone].fg }} />}
              {c.label}
            </p>
          </div>
        ))}
      </div>

      {/* Receivable risk */}
      <div className="mt-4 pt-4 border-t border-[var(--border-soft)] flex items-start justify-between gap-4">
        {risks.map((r, i) => (
          <div key={r.label} className={i === 1 ? "text-right" : ""}>
            <p className={`m-0 flex items-center gap-1.5 text-h2 font-bold text-[var(--text-primary)] ${i === 1 ? "justify-end" : ""}`}>
              <span className="w-1 h-4 rounded-full" style={{ backgroundColor: TONES[r.tone].fg }} />
              {fmt(r.value)}
            </p>
            <p className="m-0 text-card-metadata text-[var(--text-muted)]">{r.label}</p>
          </div>
        ))}
      </div>
    </DashboardSection>
  );
}
