"use client";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { TONES, Tone } from "./DashboardSection";

export interface DonutSlice { label: string; value: number; tone: Tone }

// Gray reads as "inactive" — draw it with the border token so it recedes in both themes.
const sliceColor = (tone: Tone) => (tone === "gray" ? "var(--border)" : TONES[tone].fg);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const SliceTooltip = ({ active, payload, unit }: any) => {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 shadow-lg">
      <p className="m-0 text-caption text-[var(--text-muted)]">{p.label}</p>
      <p className="m-0 text-label text-[var(--text-primary)]">{p.value} {unit}</p>
    </div>
  );
};

interface DonutWithLegendProps {
  data: DonutSlice[];
  centerLabel: string;
  /** Replaces the default centre figure (the sum of all slices), e.g. "2/4". */
  centerValue?: string;
  /** Noun for the tooltip, e.g. "users" or "jobs". */
  unit: string;
  /** Ring thickness as the inner-radius percentage (lower = thicker ring). */
  innerRadius?: string;
}

/** Donut with the total in its centre and a value/label legend beside it. */
export default function DonutWithLegend({ data, centerLabel, centerValue, unit, innerRadius = "78%" }: DonutWithLegendProps) {
  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <div className="flex items-center gap-5 sm:gap-8">
      <div className="relative w-[132px] h-[132px] sm:w-[152px] sm:h-[152px] flex-shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="label" innerRadius={innerRadius} outerRadius="100%"
              startAngle={90} endAngle={-270} stroke="var(--bg-card)" strokeWidth={2} isAnimationActive={false}>
              {data.map((d) => <Cell key={d.label} fill={sliceColor(d.tone)} />)}
            </Pie>
            <Tooltip content={<SliceTooltip unit={unit} />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-display font-bold text-[var(--text-primary)]">{centerValue ?? total}</span>
          <span className="text-card-metadata text-[var(--text-muted)]">{centerLabel}</span>
        </div>
      </div>

      <ul className="m-0 p-0 list-none flex flex-col gap-3 min-w-0">
        {data.map((d) => (
          <li key={d.label} className="grid grid-cols-[10px_36px_minmax(0,1fr)] items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: sliceColor(d.tone) }} />
            <span className="text-label font-semibold text-[var(--text-primary)]">{d.value}</span>
            <span className="text-card-metadata text-[var(--text-muted)] truncate">{d.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
