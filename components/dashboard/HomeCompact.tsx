"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  ArrowRight, CalendarCheck, CaretDown, CheckCircle, ClipboardText, CurrencyDollar, Eye, FileText, MagnifyingGlass, Plus, Tray, UsersThree, WarningCircle, Truck, ChartBar,
} from "@phosphor-icons/react";
import { PageShell, ActionMenu } from "@/components/ui/ServiceOpsUI";
import { JobStatusPill } from "@/components/workorders/woShared";
import FirstSteps from "@/components/dashboard/FirstSteps";
import HomeBanner from "@/components/dashboard/HomeBanner";
import { useHomeData, plural, greeting, type Level } from "@/components/dashboard/useHomeData";
import { SERVICE_TYPE_META } from "@/lib/jobsData";
import { jobCharges, money, TECH_PROFILES } from "@/lib/serviceData";
import { useTheme } from "@/components/ThemeContext";

const PREVIEW = 5;
const DOT: Record<Level, string> = { red: "#DC2626", amber: "#D97706", blue: "#2563EB" };
const panel = "rounded-[10px] border border-[var(--border-soft)] bg-[var(--bg-card)] min-w-0";
const outlineBtn = "inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] text-[13px] font-semibold text-[var(--text-primary)] hover:bg-[var(--serviceops-tint)] no-underline whitespace-nowrap";
const bannerBtn = "inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg border border-black/10 bg-white/90 text-[13px] font-semibold text-[#111111] hover:bg-white no-underline whitespace-nowrap";
const solidBtn = "inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-[var(--serviceops-primary)] hover:bg-[var(--serviceops-hover)] text-[13px] font-semibold text-[#111111] no-underline whitespace-nowrap";

type Tile = { label: string; value: string | number; meta: string; icon: typeof ClipboardText; color: string; href: string };

function TileCell({ t }: { t: Tile }) {
  const Icon = t.icon;
  return (
    <Link href={t.href} className="block p-4 no-underline hover:bg-[var(--serviceops-tint)] transition-colors">
      <div className="flex items-start justify-between gap-2">
        <span className="text-[13px] text-[var(--text-body)]">{t.label}</span>
        <Icon size={20} weight="duotone" color={t.color} />
      </div>
      <p className="m-0 mt-2 text-[28px] leading-[34px] font-semibold text-[var(--text-primary)] tabular-nums">{t.value}</p>
      <p className="m-0 mt-1 text-[12px] text-[var(--text-muted)] truncate">{t.meta}</p>
    </Link>
  );
}

/** Compact Home: greeting and actions, a joined grid of numbers beside a weekly chart, what needs attention, and a visits table. */
export default function HomeCompact() {
  const router = useRouter();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const { role, firstName, sees, org, newRequests, d, visits } = useHomeData();
  const [showAll, setShowAll] = useState(false);
  const [statusF, setStatusF] = useState("All");
  const [search, setSearch] = useState("");

  const tiles: Tile[] = useMemo(() => {
    const t: Tile[] = [
      { label: role === "Technician" ? "Your visits today" : "Visits today", value: visits.length, meta: d.inField ? `${d.inField} in the field` : "None started yet", icon: CalendarCheck, color: "#2563EB", href: sees.office ? "/dispatch" : "/jobs" },
    ];
    if (sees.office) {
      t.push({ label: "Open work orders", value: d.open, meta: `${d.toSchedule} ready to schedule`, icon: ClipboardText, color: "#F59E0B", href: "/work-orders" });
      if (sees.money) {
        t.push({ label: "Quotes waiting", value: money(d.waitingSum), meta: plural(d.waiting, "estimate"), icon: FileText, color: "#8B5CF6", href: "/billing" });
        t.push({ label: "Overdue invoices", value: money(d.overdueSum), meta: plural(d.overdue, "invoice"), icon: WarningCircle, color: "#DC2626", href: "/billing" });
      } else {
        t.push({ label: "In the field", value: d.inField, meta: "En route or on site", icon: Truck, color: "#8B5CF6", href: "/dispatch" });
      }
      t.push({ label: "Technicians free", value: d.techsFree, meta: `of ${TECH_PROFILES.length} today`, icon: UsersThree, color: "#16A34A", href: "/dispatch" });
      t.push({ label: "New requests", value: newRequests, meta: "Not yet looked at", icon: Tray, color: "#0891B2", href: "/requests" });
    }
    return t;
  }, [role, sees.office, sees.money, visits.length, d, newRequests]);

  const statuses = useMemo(() => ["All", ...Array.from(new Set(visits.map(j => j.status)))], [visits]);
  const rows = useMemo(() => visits.filter(j => (statusF === "All" || j.status === statusF) &&
    (!search.trim() || [j.jobId, j.customer, j.jobName, j.technician].some(x => x.toLowerCase().includes(search.trim().toLowerCase())))), [visits, statusF, search]);
  const shownItems = showAll ? d.items : d.items.slice(0, PREVIEW);
  const chartKey = sees.money ? "value" : "jobs";

  return (
    <PageShell wide>
      <HomeBanner slim banner={org.banner} image={org.image} canEdit={role === "Administrator"}
        actions={sees.office ? (
          <>
            <Link href="/work-orders?new=1" className={bannerBtn}>Create work order</Link>
            <Link href="/customers?new=1" className={solidBtn}><Plus size={14} weight="bold" />Add customer</Link>
            <ActionMenu variant="page" label="More actions" actions={[
              { label: "New request", icon: Tray, onClick: () => router.push("/requests?new=1") },
              { label: "New job", icon: ClipboardText, onClick: () => router.push("/jobs?new=1") },
              { label: "Open Dispatch", icon: Truck, onClick: () => router.push("/dispatch") },
            ]} />
          </>
        ) : undefined}>
        <h2 className="m-0 text-[20px] leading-[26px] font-semibold tracking-tight" style={{ color: "inherit" }}>{greeting()}{firstName ? `, ${firstName}` : ""}</h2>
        <p className="m-0 mt-0.5 text-[13px] opacity-85">{plural(visits.length, "visit")} today{sees.office && d.items.length ? ` · ${d.items.length} need attention` : ""}</p>
      </HomeBanner>

      {role === "Administrator" && <FirstSteps />}

      {/* Numbers beside a weekly chart, joined by hairlines */}
      <div className={`${panel} overflow-hidden grid grid-cols-1 ${tiles.length > 1 ? "lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]" : ""}`}>
        <div className="grid grid-cols-2 sm:grid-cols-3 [&>*]:border-b [&>*]:border-r [&>*]:border-[var(--border-soft)] auto-rows-fr">
          {tiles.map(t => <TileCell key={t.label} t={t} />)}
        </div>
        {tiles.length > 1 && (
          <div className="p-4 border-t lg:border-t-0 lg:border-l border-[var(--border-soft)] min-h-[240px] flex flex-col">
            <h3 className="m-0 flex items-center gap-2 text-[14px] font-semibold text-[var(--text-primary)]">
              <span className="w-6 h-6 rounded-md inline-flex items-center justify-center bg-[var(--serviceops-tint)]">{sees.money ? <CurrencyDollar size={14} weight="bold" /> : <ChartBar size={14} weight="bold" />}</span>
              {sees.money ? "Scheduled work, next 7 days" : "Visits booked, next 7 days"}
            </h3>
            <div className="flex-1 min-h-[170px] mt-3">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={d.week} margin={{ top: 4, right: 4, left: -12, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke={isDark ? "#3a2a1c" : "#EEEEEE"} />
                  <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#8A8A8A" }} />
                  <YAxis tickLine={false} axisLine={false} width={44} tick={{ fontSize: 11, fill: "#8A8A8A" }} tickFormatter={(v: number) => (sees.money ? (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)) : String(v))} />
                  <Tooltip cursor={{ fill: "rgba(245,158,11,0.08)" }} formatter={(v: number, _n, p) => [sees.money ? `${money(v)} · ${plural(p.payload.jobs, "job")}` : plural(v, "visit"), ""]} labelFormatter={l => String(l)} separator="" contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey={chartKey} fill="#F59E0B" radius={[3, 3, 0, 0]} maxBarSize={38} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {sees.office && (
        <section className={panel}>
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[var(--border-soft)]">
            <h3 className="m-0 text-[14px] font-semibold text-[var(--text-primary)]">Needs attention</h3>
            {d.items.length > 0 && <span className="text-[12px] text-[var(--text-muted)]">{d.items.length}</span>}
          </div>
          {d.items.length === 0 ? (
            <p className="flex items-center gap-2 m-0 px-4 py-4 text-body text-[var(--text-body)]"><CheckCircle size={18} weight="fill" color="#16A34A" />Nothing needs you right now.</p>
          ) : (
            <ul className="m-0 p-0 list-none">
              {shownItems.map((it, i) => (
                <li key={i} className="border-b border-[var(--border-soft)] last:border-b-0">
                  <Link href={it.href} className="flex items-center gap-3 px-4 py-2.5 no-underline hover:bg-[var(--serviceops-tint)]">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: DOT[it.level] }} aria-hidden />
                    <span className="min-w-0 flex-1 truncate text-[13.5px]"><b className="font-semibold text-[var(--text-primary)]">{it.title}</b><span className="text-[var(--text-muted)]"> · {it.detail}</span></span>
                    <span className="inline-flex items-center gap-1 text-[13px] font-semibold text-blue-600 whitespace-nowrap">{it.cta}<ArrowRight size={12} weight="bold" /></span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {d.items.length > PREVIEW && (
            <button type="button" onClick={() => setShowAll(v => !v)} aria-expanded={showAll}
              className="w-full inline-flex items-center justify-center gap-1.5 h-10 border-t border-[var(--border-soft)] text-[13px] font-semibold text-blue-600 hover:bg-[var(--serviceops-tint)] rounded-b-[10px]">
              {showAll ? "Show fewer" : `View all ${d.items.length} items`}<CaretDown size={13} weight="bold" className={showAll ? "rotate-180" : ""} />
            </button>
          )}
        </section>
      )}

      {/* Visits table */}
      <section className={panel}>
        <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-[var(--border-soft)]">
          <h3 className="m-0 flex items-center gap-2 text-[14px] font-semibold text-[var(--text-primary)]">
            <span className="w-6 h-6 rounded-md inline-flex items-center justify-center bg-[var(--serviceops-tint)]"><CalendarCheck size={14} weight="bold" /></span>
            {role === "Technician" ? "Your visits today" : "Today's visits"}
          </h3>
          <select aria-label="Filter by status" value={statusF} onChange={e => setStatusF(e.target.value)}
            className="h-9 px-2.5 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] text-[13px] text-[var(--text-primary)]">
            {statuses.map(s => <option key={s} value={s}>{s === "All" ? "All statuses" : s}</option>)}
          </select>
          <div className="flex-1" />
          <label className="relative">
            <MagnifyingGlass size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input aria-label="Search visits" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search"
              className="h-9 w-[180px] pl-8 pr-2.5 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--serviceops-primary)]" />
          </label>
          {sees.office && <Link href="/jobs?new=1" className={solidBtn}><Plus size={14} weight="bold" />Add job</Link>}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-[13px] border-collapse">
            <thead>
              <tr className="text-left text-[12px] text-[var(--text-body)] bg-[var(--serviceops-tint)]">
                {["Job", "Customer", "Service type", "Technician", "Time", "Status", "Location", ...(sees.money ? ["Value"] : []), ""].map(h => <th key={h} className="px-3 font-semibold whitespace-nowrap">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={9} className="px-3 py-6 text-center text-[var(--text-muted)]">{visits.length ? "No visits match." : "No visits booked today."}</td></tr>}
              {rows.slice(0, 7).map(j => (
                <tr key={j.id} className="border-t border-[var(--border-soft)] hover:bg-[var(--serviceops-tint)]">
                  <td className="px-3"><Link href={`/jobs/${j.id}`} className="font-semibold text-blue-600 no-underline hover:underline">{j.jobId}</Link></td>
                  <td className="px-3 text-[var(--text-primary)] whitespace-nowrap">{j.customer}</td>
                  <td className="px-3 whitespace-nowrap"><span className="inline-flex items-center gap-1.5" style={{ color: isDark ? SERVICE_TYPE_META[j.serviceType].dark : SERVICE_TYPE_META[j.serviceType].light }}><span className="w-1.5 h-1.5 rounded-full" style={{ background: "currentColor" }} />{j.serviceType}</span></td>
                  <td className="px-3 text-[var(--text-body)] whitespace-nowrap">{j.technician}</td>
                  <td className="px-3 text-[var(--text-body)] whitespace-nowrap tabular-nums">{j.scheduledTime}</td>
                  <td className="px-3"><JobStatusPill status={j.status} /></td>
                  <td className="px-3 text-[var(--text-body)] whitespace-nowrap">{j.location}</td>
                  {sees.money && <td className="px-3 text-[var(--text-primary)] tabular-nums">{money(jobCharges(j).total)}</td>}
                  <td className="px-3 text-right"><Link href={`/jobs/${j.id}`} aria-label={`Open ${j.jobId}`} className="inline-flex p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)]"><Eye size={16} /></Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length > 7 && (
          <Link href={sees.office ? "/dispatch" : "/jobs"} className="flex items-center justify-center gap-1.5 h-10 border-t border-[var(--border-soft)] text-[13px] font-semibold text-blue-600 no-underline hover:bg-[var(--serviceops-tint)] rounded-b-[10px]">
            {sees.office ? `View all ${rows.length} visits in Dispatch` : `View all ${rows.length} of your jobs`}<ArrowRight size={13} weight="bold" />
          </Link>
        )}
      </section>
    </PageShell>
  );
}

