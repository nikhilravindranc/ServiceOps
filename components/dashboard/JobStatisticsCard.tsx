"use client";
import { useState } from "react";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import { CaretDown } from "@phosphor-icons/react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList, Text } from "recharts";
import DashboardSection, { BarStat, TONES, Tone } from "./DashboardSection";

interface CategoryData {
  stats: { total: number; yetToStart: number; inProgress: number; cancelled: number; incomplete: number; completed: number };
  pipeline: { due: number; scheduled: number; newJobs: number; completed: number };
}

const DATA: Record<string, CategoryData> = {
  "All category":     { stats: { total: 61, yetToStart: 43, inProgress: 12, cancelled: 0, incomplete: 1, completed: 4 }, pipeline: { due: 2,  scheduled: 61, newJobs: 45, completed: 50 } },
  "HVAC":             { stats: { total: 24, yetToStart: 17, inProgress: 5,  cancelled: 0, incomplete: 0, completed: 2 }, pipeline: { due: 1,  scheduled: 24, newJobs: 18, completed: 21 } },
  "Electrical":       { stats: { total: 21, yetToStart: 15, inProgress: 4,  cancelled: 0, incomplete: 1, completed: 1 }, pipeline: { due: 1,  scheduled: 21, newJobs: 15, completed: 17 } },
  "Plumbing":         { stats: { total: 16, yetToStart: 11, inProgress: 3,  cancelled: 0, incomplete: 0, completed: 1 }, pipeline: { due: 0,  scheduled: 16, newJobs: 12, completed: 12 } },
};

const STAT_TILES: { key: keyof CategoryData["stats"]; label: string; tone: Tone }[] = [
  { key: "total",      label: "Total Jobs",   tone: "purple" },
  { key: "yetToStart", label: "Yet to Start", tone: "blue" },
  { key: "inProgress", label: "In Progress",  tone: "red" },
  { key: "cancelled",  label: "Cancelled",    tone: "yellow" },
  { key: "incomplete", label: "Incomplete",   tone: "amber" },
  { key: "completed",  label: "Completed",    tone: "green" },
];

// Category label that wraps to the bar's band width, so long names don't collide on narrow screens.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const BandTick = ({ x, y, payload, width, visibleTicksCount }: any) => (
  <Text x={x} y={y + 6} width={Math.max(40, width / (visibleTicksCount || 1) - 6)} textAnchor="middle" verticalAnchor="start"
    style={{ fontSize: 12, fill: "var(--text-body)" }}>
    {payload.value}
  </Text>
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const BarTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 shadow-lg">
      <p className="m-0 text-caption text-[var(--text-muted)]">{p.name}</p>
      <p className="m-0 text-label text-[var(--text-primary)]">{p.value} jobs</p>
    </div>
  );
};

export default function JobStatisticsCard() {
  const [category, setCategory] = useState<string>("All category");
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const { stats, pipeline } = DATA[category];

  const bars = [
    { name: "Due Jobs",       value: pipeline.due,       color: TONES.purple.fg },
    { name: "Scheduled",      value: pipeline.scheduled, color: TONES.blue.fg },
    { name: "New Jobs",       value: pipeline.newJobs,   color: TONES.red.fg },
    { name: "Completed Jobs", value: pipeline.completed, color: TONES.green.fg },
  ];

  return (
    <DashboardSection
      title="Job statistics"
      headerRight={
        <>
          <button
            type="button"
            onClick={(e) => setAnchor(e.currentTarget)}
            className="inline-flex items-center gap-1.5 text-card-metadata text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          >
            {category}
            <CaretDown size={11} weight="bold" />
          </button>
          <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}
            anchorOrigin={{ vertical: "bottom", horizontal: "right" }} transformOrigin={{ vertical: "top", horizontal: "right" }}
            slotProps={{ paper: { sx: { mt: 0.75, borderRadius: "12px", minWidth: 180 } } }}>
            {Object.keys(DATA).map((c) => (
              <MenuItem key={c} selected={c === category} onClick={() => { setCategory(c); setAnchor(null); }} sx={{ fontSize: 14 }}>
                {c}
              </MenuItem>
            ))}
          </Menu>
        </>
      }
    >
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-x-3 gap-y-3">
        {STAT_TILES.map(({ key, label, tone }) => (
          <BarStat key={key} value={stats[key]} label={label} tone={tone} />
        ))}
      </div>

      <div className="mt-5 h-[200px] sm:h-[210px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={bars} margin={{ top: 22, right: 4, left: -22, bottom: 0 }} barCategoryGap="14%">
            <CartesianGrid vertical={false} stroke="var(--border-soft)" />
            <XAxis dataKey="name" axisLine={{ stroke: "var(--border)" }} tickLine={false}
              tick={<BandTick />} interval={0} height={36} />
            <YAxis domain={[0, 80]} ticks={[0, 20, 40, 60, 80]} axisLine={false} tickLine={false}
              tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
            <Tooltip content={<BarTooltip />} cursor={{ fill: "var(--serviceops-primary-10)" }} />
            <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={84} minPointSize={3}>
              {bars.map((b) => <Cell key={b.name} fill={b.color} />)}
              <LabelList dataKey="value" position="top" offset={8} style={{ fontSize: 14, fontWeight: 600, fill: "var(--text-primary)" }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </DashboardSection>
  );
}
