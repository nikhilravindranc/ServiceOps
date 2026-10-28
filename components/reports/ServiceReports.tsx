"use client";
import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, LineChart, Line, ReferenceLine, Cell,
} from "recharts";
import {
  Export as ExportIcon, Lightbulb, ClipboardText, Users, Buildings, Receipt, Timer,
} from "@phosphor-icons/react";
import { PageShell, PageHeader, SecondaryButton, Segmented, MiniTable, useToast } from "@/components/ui/ServiceOpsUI";
import { CARD_SHADOW } from "@/components/dashboard/DashboardSection";
import { useTheme } from "@/components/ThemeContext";
import { ALL_JOBS, STATUS_ORDER, STATUS_META, SLA_HOURS_BY_SERVICE, SERVICE_TYPE_ORDER } from "@/lib/jobsData";
import {
  SERVICE_HISTORY, TECH_PROFILES, CUSTOMERS, PARTS, allInvoices, bookedHours, partUsed30, outstanding, money,
  JOBS_TODAY_TS, DAY_MS,
} from "@/lib/serviceData";

type Kind = "hbar" | "bar" | "line";
interface Datum { label: string; value: number; color?: string }
interface Report {
  key: string;
  group: "Operations" | "Team" | "Customers" | "Parts & billing";
  title: string;
  question: string;
  kind: Kind;
  unit: string;
  fmt: (n: number) => string;
  headline: { label: string; value: string }[];
  data: Datum[];
  insight: string;
  ref?: { value: number; label: string };
  domainMax?: number;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const pct = (n: number) => `${Math.round(n)}%`;
const monthKey = (t: number) => { const d = new Date(t); return `${MONTHS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`; };
const lastMonths = (n: number) => Array.from({ length: n }, (_, i) => { const d = new Date(JOBS_TODAY_TS); d.setDate(1); d.setMonth(d.getMonth() - (n - 1 - i)); return monthKey(d.getTime()); });

function buildReports(isDark: boolean): Report[] {
  const statusColor = (s: keyof typeof STATUS_META) => (isDark ? STATUS_META[s].dark : STATUS_META[s].light);
  const year = SERVICE_HISTORY.filter(v => v.date > JOBS_TODAY_TS - 365 * DAY_MS);

  // 1 · Jobs by status
  const byStatus = STATUS_ORDER.map(s => ({ label: s, value: ALL_JOBS.filter(j => j.status === s).length, color: statusColor(s) }));
  const open = ALL_JOBS.filter(j => !["Completed", "Cancelled"].includes(j.status)).length;

  // 2 · Completion — visits completed per month
  const months = lastMonths(12);
  const completed = months.map(m => ({ label: m, value: SERVICE_HISTORY.filter(v => monthKey(v.date) === m).length }));
  const last3 = completed.slice(-3).reduce((s, d) => s + d.value, 0) / 3;
  const prev3 = completed.slice(-6, -3).reduce((s, d) => s + d.value, 0) / 3;

  // 3 · Utilization — booked hours vs shift over the next 5 working days
  const util = TECH_PROFILES.map(t => {
    let booked = 0, cap = 0;
    for (let d = 0; d < 5; d++) { const day = JOBS_TODAY_TS + d * DAY_MS; booked += bookedHours(t.name, day); cap += t.shift[1] - t.shift[0]; }
    return { label: t.name, value: t.onLeave ? 0 : Math.round((booked / cap) * 100) };
  }).sort((a, b) => b.value - a.value);
  const avgUtil = util.filter(u => u.value > 0).reduce((s, u) => s + u.value, 0) / Math.max(1, util.filter(u => u.value > 0).length);

  // 4 · SLA — share of visits responded to within SLA, by service type
  const sla = SERVICE_TYPE_ORDER.filter(s => s !== "Preventive").map(s => {
    const vs = year.filter(v => v.serviceType === s);
    return { label: s, value: vs.length ? (vs.filter(v => v.responseHrs <= SLA_HOURS_BY_SERVICE[s]).length / vs.length) * 100 : 0 };
  });
  const slaAll = year.length ? (year.filter(v => v.responseHrs <= SLA_HOURS_BY_SERVICE[v.serviceType]).length / year.length) * 100 : 0;
  const worstSla = [...sla].sort((a, b) => a.value - b.value)[0];
  const breachedNow = ALL_JOBS.filter(j => j.slaBreached).length;

  // 5 · Response time trend
  const resp = months.map(m => { const vs = SERVICE_HISTORY.filter(v => monthKey(v.date) === m); return { label: m, value: vs.length ? Math.round((vs.reduce((s, v) => s + v.responseHrs, 0) / vs.length) * 10) / 10 : 0 }; }).filter(d => d.value > 0);
  const avgResp = year.length ? year.reduce((s, v) => s + v.responseHrs, 0) / year.length : 0;

  // 6 · First-time fix by technician
  const ftf = TECH_PROFILES.map(t => { const vs = year.filter(v => v.technician === t.name); return { label: t.name, value: vs.length ? (vs.filter(v => v.firstTimeFix).length / vs.length) * 100 : 0 }; }).sort((a, b) => b.value - a.value);
  const ftfAll = year.length ? (year.filter(v => v.firstTimeFix).length / year.length) * 100 : 0;
  const ftfLow = ftf[ftf.length - 1];

  // 7 · Activity by customer
  const byCust = CUSTOMERS.map(c => ({ label: c.name, value: year.filter(v => v.customer === c.name).length + ALL_JOBS.filter(j => j.customer === c.name).length })).sort((a, b) => b.value - a.value).slice(0, 10);
  const top3Share = byCust.slice(0, 3).reduce((s, d) => s + d.value, 0) / Math.max(1, byCust.reduce((s, d) => s + d.value, 0) + CUSTOMERS.slice(10).length);

  // 8 · Parts usage
  const parts = PARTS.map(p => ({ label: p.name, value: partUsed30(p) })).filter(d => d.value > 0).sort((a, b) => b.value - a.value).slice(0, 10);

  // 9 · Billable activity — invoiced value per month
  const inv = allInvoices();
  const billed = months.map(m => ({ label: m, value: inv.filter(i => monthKey(i.issuedOn) === m).reduce((s, i) => s + i.amount, 0) }));
  const outstandingNow = inv.reduce((s, i) => s + outstanding(i), 0);

  return [
    {
      key: "jobs-status", group: "Operations", title: "Jobs by status", question: "Where does the current workload stand?", kind: "hbar", unit: "jobs", fmt: n => String(n),
      headline: [{ label: "Open jobs", value: String(open) }, { label: "Incomplete", value: String(byStatus.find(d => d.label === "Incomplete")?.value ?? 0) }],
      data: byStatus, insight: `${open} of ${ALL_JOBS.length} jobs are still open; most are booked but not started, so the next few days carry the load.`,
    },
    {
      key: "completion", group: "Operations", title: "Job completion", question: "Are we completing more or less work than before?", kind: "bar", unit: "visits", fmt: n => String(n),
      headline: [{ label: "Avg / month (last 3)", value: last3.toFixed(1) }, { label: "Prior 3 months", value: prev3.toFixed(1) }],
      data: completed, insight: last3 >= prev3 ? `Completions are up ${Math.round(((last3 - prev3) / Math.max(1, prev3)) * 100)}% on the previous quarter.` : `Completions are down ${Math.round(((prev3 - last3) / Math.max(1, prev3)) * 100)}% on the previous quarter — check capacity and open backlog.`,
    },
    {
      key: "sla", group: "Operations", title: "SLA performance", question: "Are we responding within the agreed time?", kind: "bar", unit: "% within SLA", fmt: pct, domainMax: 100,
      headline: [{ label: "Within SLA · 12 mo", value: pct(slaAll) }, { label: "Breached right now", value: String(breachedNow) }],
      data: sla, ref: { value: 90, label: "Target 90%" }, insight: `${worstSla?.label} is furthest from target at ${pct(worstSla?.value ?? 0)} — its ${SLA_HOURS_BY_SERVICE[worstSla?.label as keyof typeof SLA_HOURS_BY_SERVICE] ?? "?"}h window is tight for current coverage.`,
    },
    {
      key: "response", group: "Operations", title: "Response time", question: "How long do customers wait for a technician?", kind: "line", unit: "hours", fmt: n => `${n}h`,
      headline: [{ label: "Average · 12 mo", value: `${avgResp.toFixed(1)}h` }, { label: "Latest month", value: `${resp[resp.length - 1]?.value ?? 0}h` }],
      data: resp, insight: "Average hours from request to arrival, across all completed visits each month.",
    },
    {
      key: "first-time-fix", group: "Team", title: "First-time fix", question: "How often is the job done in one visit?", kind: "hbar", unit: "% first-time fix", fmt: pct, domainMax: 100,
      headline: [{ label: "Team · 12 mo", value: pct(ftfAll) }, { label: "Lowest", value: `${ftfLow?.label.split(" ")[0]} ${pct(ftfLow?.value ?? 0)}` }],
      data: ftf, ref: { value: 85, label: "Target 85%" }, insight: "Repeat visits usually trace back to missing parts — compare with van stock gaps in Inventory.",
    },
    {
      key: "utilization", group: "Team", title: "Technician utilization", question: "Who has capacity this week?", kind: "hbar", unit: "% of shift booked", fmt: pct, domainMax: 100,
      headline: [{ label: "Team average", value: pct(avgUtil) }, { label: "Under 40% booked", value: String(util.filter(u => u.value > 0 && u.value < 40).length) }],
      data: util, ref: { value: 85, label: "Overbooked" }, insight: `Next 5 days. ${util.filter(u => u.value > 0 && u.value < 40).map(u => u.label.split(" ")[0]).join(", ") || "Nobody"} can take more work; route new requests there first.`,
    },
    {
      key: "customers", group: "Customers", title: "Service activity by customer", question: "Which customers need the most service?", kind: "hbar", unit: "visits", fmt: n => String(n),
      headline: [{ label: "Most active", value: byCust[0]?.label ?? "—" }, { label: "Top 3 share", value: pct(top3Share * 100) }],
      data: byCust, insight: "Completed visits in the last 12 months plus currently scheduled jobs. High counts on Pay-per-visit customers are AMC opportunities.",
    },
    {
      key: "parts", group: "Parts & billing", title: "Parts usage", question: "Which parts are we consuming fastest?", kind: "hbar", unit: "units · 30 days", fmt: n => String(n),
      headline: [{ label: "Units used · 30 days", value: String(parts.reduce((s, d) => s + d.value, 0)) }, { label: "Top part", value: parts[0]?.label ?? "—" }],
      data: parts, insight: "Fast movers should be carried in every relevant van — see Technician stock in Inventory.",
    },
    {
      key: "billable", group: "Parts & billing", title: "Billable service activity", question: "How much service work are we billing?", kind: "bar", unit: "invoiced", fmt: n => money(n),
      headline: [{ label: "Invoiced · 12 mo", value: money(billed.reduce((s, d) => s + d.value, 0)) }, { label: "Outstanding now", value: money(outstandingNow) }],
      data: billed, insight: "Invoice value by month issued. Outstanding includes overdue balances — follow up from Billing.",
    },
  ];
}

const GROUP_ICON = { Operations: ClipboardText, Team: Users, Customers: Buildings, "Parts & billing": Receipt } as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ChartTip({ active, payload, fmt, unit }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload as Datum;
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 shadow-lg">
      <p className="m-0 text-caption text-[var(--text-muted)]">{d.label}</p>
      <p className="m-0 text-label text-[var(--text-primary)]">{fmt(d.value)} <span className="text-caption text-[var(--text-muted)]">{unit}</span></p>
    </div>
  );
}

export default function ServiceReports() {
  const router = useRouter();
  const params = useSearchParams();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const { toastNode, notify } = useToast();
  const reports = useMemo(() => buildReports(isDark), [isDark]);
  const [key, setKey] = useState(() => params.get("r") && reports.some(r => r.key === params.get("r")) ? params.get("r")! : reports[0].key);
  const [view, setView] = useState<"chart" | "table">("chart");
  const r = reports.find(x => x.key === key) ?? reports[0];

  // One hue for single-series magnitude; status reports keep their status colours.
  const ink = isDark ? "#60A5FA" : "#2563EB";
  const grid = isDark ? "#4B2F1C" : "#F0F0F0";
  const axis = isDark ? "#D0A966" : "#6B6B6B";
  const tick = { fill: axis, fontSize: 12 };
  const height = r.kind === "hbar" ? Math.max(260, r.data.length * 36 + 40) : 320;

  const pick = (k: string) => { setKey(k); router.replace(`/reports?r=${k}`, { scroll: false }); };
  const groups = Array.from(new Set(reports.map(x => x.group)));

  return (
    <PageShell>
      <PageHeader title="Reports" subtitle="Answers to the questions service managers ask every week."
        actions={<SecondaryButton icon={ExportIcon} onClick={() => notify(`"${r.title}" exported to CSV`)}>Export</SecondaryButton>} />

      <div className="grid grid-cols-1 md:grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)] gap-4 items-start">
        {/* Report list — grouped by the question's area */}
        <nav aria-label="Reports" className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-2 lg:sticky lg:top-[88px]" style={{ boxShadow: CARD_SHADOW }}>
          <div className="lg:hidden p-1">
            <select value={key} onChange={e => pick(e.target.value)} aria-label="Choose report"
              className="w-full h-11 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-3 text-body text-[var(--text-primary)]">
              {reports.map(x => <option key={x.key} value={x.key}>{x.group} · {x.title}</option>)}
            </select>
          </div>
          <div className="hidden lg:block">
            {groups.map(g => {
              const Icon = GROUP_ICON[g];
              return (
                <div key={g} className="mb-1">
                  <p className="m-0 px-3 pt-3 pb-1.5 inline-flex items-center gap-1.5 text-nav-group-label uppercase text-[var(--text-muted)]"><Icon size={13} weight="duotone" />{g}</p>
                  {reports.filter(x => x.group === g).map(x => (
                    <button key={x.key} type="button" onClick={() => pick(x.key)} aria-current={x.key === key ? "page" : undefined}
                      className={`w-full text-left rounded-lg px-3 py-2 transition-colors ${x.key === key ? "bg-[var(--serviceops-primary-10)]" : "hover:bg-[var(--serviceops-tint)]"}`}>
                      <span className="block text-body font-medium text-[var(--text-primary)]">{x.title}</span>
                      <span className="block text-caption text-[var(--text-muted)]">{x.question}</span>
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        </nav>

        <section className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-4 sm:p-5 min-w-0" style={{ boxShadow: CARD_SHADOW }}>
          <header className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="m-0 text-caption uppercase tracking-wide text-[var(--text-muted)]">{r.group}</p>
              <h2 className="m-0 mt-1 text-h1 font-bold text-[var(--text-primary)]">{r.question}</h2>
              <p className="m-0 mt-0.5 text-body text-[var(--text-body)]">{r.title} · {r.unit}</p>
            </div>
            <Segmented size="sm" value={view} onChange={setView} options={[{ value: "chart", label: "Chart" }, { value: "table", label: "Table" }]} />
          </header>

          <div className="mt-5 grid grid-cols-2 gap-3 sm:max-w-[520px]">
            {r.headline.map(h => (
              <div key={h.label} className="rounded-xl bg-[var(--serviceops-tint)] px-4 py-3 min-w-0">
                <p className="m-0 text-caption text-[var(--text-muted)]">{h.label}</p>
                <p className="m-0 text-h1 font-bold text-[var(--text-primary)] truncate">{h.value}</p>
              </div>
            ))}
          </div>

          <div className="mt-5" role="img" aria-label={`${r.title}: ${r.data.map(d => `${d.label} ${r.fmt(d.value)}`).join(", ")}`}>
            {view === "table" ? (
              <MiniTable head={[r.kind === "line" || r.kind === "bar" ? "Period" : "Item", { label: r.unit, right: true }]} minWidth={360}>
                {r.data.map(d => (
                  <tr key={d.label}>
                    <td className="px-4 text-table-cell text-[var(--text-primary)]">{d.label}</td>
                    <td className="px-4 text-right text-table-cell font-semibold text-[var(--text-primary)]">{r.fmt(d.value)}</td>
                  </tr>
                ))}
              </MiniTable>
            ) : (
              <ResponsiveContainer width="100%" height={height}>
                {r.kind === "line" ? (
                  <LineChart data={r.data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                    <CartesianGrid stroke={grid} vertical={false} />
                    <XAxis dataKey="label" tick={tick} axisLine={false} tickLine={false} />
                    <YAxis tick={tick} axisLine={false} tickLine={false} width={40} tickFormatter={r.fmt} />
                    <Tooltip content={<ChartTip fmt={r.fmt} unit={r.unit} />} cursor={{ stroke: axis, strokeDasharray: "3 3" }} />
                    <Line type="monotone" dataKey="value" stroke={ink} strokeWidth={2} dot={{ r: 4, fill: ink, stroke: isDark ? "#18110B" : "#fff", strokeWidth: 2 }} activeDot={{ r: 6 }} isAnimationActive={false} />
                  </LineChart>
                ) : r.kind === "bar" ? (
                  <BarChart data={r.data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }} barCategoryGap="28%">
                    <CartesianGrid stroke={grid} vertical={false} />
                    <XAxis dataKey="label" tick={tick} axisLine={false} tickLine={false} interval={0} />
                    <YAxis tick={tick} axisLine={false} tickLine={false} width={r.fmt(1000).length > 5 ? 64 : 40} tickFormatter={r.fmt} domain={[0, r.domainMax ?? "auto"]} />
                    <Tooltip content={<ChartTip fmt={r.fmt} unit={r.unit} />} cursor={{ fill: isDark ? "rgba(255,255,255,0.04)" : "rgba(17,17,17,0.04)" }} />
                    {r.ref && <ReferenceLine y={r.ref.value} stroke={axis} strokeDasharray="4 4" label={{ value: r.ref.label, position: "insideTopRight", fill: axis, fontSize: 11 }} />}
                    <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={36} isAnimationActive={false}>
                      {r.data.map(d => <Cell key={d.label} fill={d.color ?? ink} />)}
                    </Bar>
                  </BarChart>
                ) : (
                  <BarChart data={r.data} layout="vertical" margin={{ top: 4, right: 40, bottom: 0, left: 8 }} barCategoryGap="30%">
                    <CartesianGrid stroke={grid} horizontal={false} />
                    <XAxis type="number" tick={tick} axisLine={false} tickLine={false} tickFormatter={r.fmt} domain={[0, r.domainMax ?? "auto"]} />
                    <YAxis type="category" dataKey="label" tick={{ ...tick, fill: isDark ? "#F7E2B2" : "#3D3D3D" }} axisLine={false} tickLine={false} width={180} />
                    <Tooltip content={<ChartTip fmt={r.fmt} unit={r.unit} />} cursor={{ fill: isDark ? "rgba(255,255,255,0.04)" : "rgba(17,17,17,0.04)" }} />
                    {r.ref && <ReferenceLine x={r.ref.value} stroke={axis} strokeDasharray="4 4" label={{ value: r.ref.label, position: "top", fill: axis, fontSize: 11 }} />}
                    <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={18} isAnimationActive={false}
                      label={{ position: "right", fill: isDark ? "#F7E2B2" : "#3D3D3D", fontSize: 12, formatter: (v: number) => r.fmt(v) }}>
                      {r.data.map(d => <Cell key={d.label} fill={d.color ?? ink} />)}
                    </Bar>
                  </BarChart>
                )}
              </ResponsiveContainer>
            )}
          </div>

          <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-[var(--border-soft)] px-4 py-3">
            <Lightbulb size={18} weight="duotone" className="mt-0.5 flex-shrink-0 text-[#D97706]" />
            <p className="m-0 text-body text-[var(--text-body)]">{r.insight}</p>
          </div>
          <p className="m-0 mt-3 inline-flex items-center gap-1.5 text-caption text-[var(--text-muted)]"><Timer size={13} />Data as of Sep 24, 2024, 10:15 AM · completed visits and live schedule</p>
        </section>
      </div>
      {toastNode}
    </PageShell>
  );
}

