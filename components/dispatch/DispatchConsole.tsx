"use client";
import { DragEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Avatar from "@mui/material/Avatar";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import Tooltip from "@mui/material/Tooltip";
import useMediaQuery from "@mui/material/useMediaQuery";
import {
  CaretLeft, CaretRight, CalendarBlank, Truck, WarningCircle, Clock, MapPin, Phone, ArrowSquareOut, X, Flag,
  CheckCircle, Lightning, UserSwitch, HourglassMedium, Path, Info, DotsSixVertical, Sparkle, ClipboardText,
} from "@phosphor-icons/react";
import { Breadcrumb, Pill, PriorityTag, Segmented, FilterSelect, SERVICE_ICON, useToast, type PillTone } from "@/components/ui/ServiceOpsUI";
import { CARD_SHADOW } from "@/components/dashboard/DashboardSection";
import { JobStatusPill } from "@/components/workorders/woShared";
import dynamic from "next/dynamic";
import { loadCerts, certProblem } from "@/lib/certStore";

// Leaflet touches window, so the map loads in the browser only.
const DispatchMap = dynamic(() => import("@/components/dispatch/DispatchMap"), { ssr: false, loading: () => <div className="flex-1 flex items-center justify-center text-[13px] text-[var(--text-muted)]">Loading map…</div> });
import { useTheme } from "@/components/ThemeContext";
import { ALL_JOBS, STATUS_META, type JobRecord } from "@/lib/jobsData";
import {
  WORK_ORDERS, TECH_PROFILES, SERVICE_ZONES, JOBS_TODAY_TS, DAY_MS, JOB_DURATION_HRS, woStatus, workOrderById,
  customerByName, workOrderForJob, jobsOnDay, jobWindow, travelMinutes, techAvailability, techProfile, techBusy, suggestTechnicians,
  bookedHours, nextFreeSlot, dispatchAlerts, dispatchWorkOrder, rescheduleJob, startOfDay, DATASET_CLOCK, fmtDate, fmtDay,
  fmtTime, customerById, type WorkOrder, type Availability,
} from "@/lib/serviceData";

const START_H = 7;
const END_H = 19;
const SPAN_MS = (END_H - START_H) * 3600 * 1000;
const SLOT_MS = 30 * 60 * 1000;
const HOURS = Array.from({ length: END_H - START_H }, (_, i) => START_H + i);
const AVAIL_TONE: Record<Availability, PillTone> = { Available: "green", "On job": "blue", "Off today": "gray", "On leave": "gray" };

type Sel = { kind: "wo"; id: number } | { kind: "job"; id: number } | { kind: "tech"; name: string } | null;
type DragPayload = { kind: "wo"; id: number } | { kind: "job"; id: number };
type Pending = { payload: DragPayload; tech: string; start: number };

const hourLabel = (h: number) => `${h % 12 === 0 ? 12 : h % 12} ${h < 12 ? "AM" : "PM"}`;
const pct = (t: number, day0: number) => ((t - (day0 + START_H * 3600000)) / SPAN_MS) * 100;
const weekday = (t: number) => new Date(t).toLocaleDateString("en-US", { weekday: "short" });

function Panel({ title, right, children, className = "" }: { title: ReactNode; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-card)] flex flex-col min-w-0 min-h-0 ${className}`} style={{ boxShadow: CARD_SHADOW }}>
      <header className="flex items-center justify-between gap-3 px-4 pt-4 pb-3 flex-shrink-0">
        <h2 className="m-0 text-h2 font-bold text-[var(--text-primary)] truncate">{title}</h2>
        {right}
      </header>
      {children}
    </section>
  );
}

export default function DispatchConsole() {
  const router = useRouter();
  const params = useSearchParams();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const { toastNode, notify } = useToast();
  const isLG = useMediaQuery("(min-width:1024px)");

  const [version, setVersion] = useState(0);
  const refresh = () => setVersion(v => v + 1);
  const [day, setDay] = useState(startOfDay(JOBS_TODAY_TS));
  const [view, setView] = useState<"timeline" | "map">("timeline");
  const [showLoad, setShowLoad] = useState(false);
  const [queueTab, setQueueTab] = useState<"queue" | "attention">("queue");
  const [zoneF, setZoneF] = useState("All zones");
  const [sel, setSel] = useState<Sel>(null);
  const [mobilePane, setMobilePane] = useState<"queue" | "schedule">("schedule");
  const [hover, setHover] = useState<{ tech: string; start: number; durMs: number } | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const dragRef = useRef<DragPayload | null>(null);
  // While dragging, the details overlay steps aside so every hour is a drop target.
  const [dragging, setDragging] = useState(false);

  // Deep link from a work order ("Schedule in Dispatch").
  useEffect(() => {
    const id = Number(params.get("wo"));
    const wo = id ? workOrderById(id) : undefined;
    if (wo) {
      setSel({ kind: "wo", id: wo.id });
      if (wo.preferredDate && wo.preferredDate >= startOfDay(JOBS_TODAY_TS)) setDay(startOfDay(wo.preferredDate));
      setMobilePane("queue");
    }
  }, [params]);

  const isToday = day === startOfDay(JOBS_TODAY_TS);
  const zoneOk = (z: string) => zoneF === "All zones" || z === zoneF;

  const queue = useMemo(() => WORK_ORDERS
    .filter(w => woStatus(w) === "Ready to schedule" && zoneOk(w.zone))
    .sort((a, b) => ["High", "Medium", "Low"].indexOf(a.priority) - ["High", "Medium", "Low"].indexOf(b.priority) || (a.preferredDate ?? Infinity) - (b.preferredDate ?? Infinity)),
  [version, zoneF]); // eslint-disable-line react-hooks/exhaustive-deps
  const notReady = useMemo(() => WORK_ORDERS.filter(w => ["New", "Awaiting approval"].includes(woStatus(w))).length, [version]);
  const alerts = useMemo(() => dispatchAlerts(JOBS_TODAY_TS).filter(a => zoneOk(a.job.region)), [version, zoneF]); // eslint-disable-line react-hooks/exhaustive-deps
  const dayJobs = useMemo(() => jobsOnDay(day), [day, version]);
  const techs = useMemo(() => TECH_PROFILES.filter(t => zoneOk(t.zone) || dayJobs.some(j => j.technician === t.name && zoneOk(j.region))), [zoneF, dayJobs]); // eslint-disable-line react-hooks/exhaustive-deps

  const selWO = sel?.kind === "wo" ? workOrderById(sel.id) : undefined;
  const selJob = sel?.kind === "job" ? ALL_JOBS.find(j => j.id === sel.id) : undefined;
  const selTech = sel?.kind === "tech" ? techProfile(sel.name) : undefined;

  const stats = {
    scheduled: dayJobs.filter(j => !["Completed", "Cancelled"].includes(j.status)).length,
    moving: dayJobs.filter(j => j.status === "En route" || j.status === "On site").length,
    done: dayJobs.filter(j => j.status === "Completed").length,
    free: TECH_PROFILES.filter(t => techAvailability(t.name, day) === "Available").length,
  };

  // ── Drag & drop ──
  const durationOf = (p: DragPayload) => {
    if (p.kind === "wo") { const w = workOrderById(p.id); return w ? JOB_DURATION_HRS[w.serviceType] * 3600000 : 2 * 3600000; }
    const j = ALL_JOBS.find(x => x.id === p.id); if (!j) return 2 * 3600000;
    const w = jobWindow(j); return w.end - w.start;
  };
  const timeFromEvent = (e: DragEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const frac = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    const raw = day + START_H * 3600000 + frac * SPAN_MS;
    return Math.min(day + END_H * 3600000 - SLOT_MS, Math.round(raw / SLOT_MS) * SLOT_MS);
  };
  const onDragStart = (e: DragEvent, p: DragPayload) => {
    dragRef.current = p;
    // Defer so the browser captures the drag image before the layout changes.
    setTimeout(() => setDragging(true), 0);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", JSON.stringify(p));
  };
  const onTrackOver = (e: DragEvent<HTMLDivElement>, tech: string) => {
    if (!dragRef.current) return;
    e.preventDefault();
    const start = timeFromEvent(e);
    if (!hover || hover.tech !== tech || hover.start !== start) setHover({ tech, start, durMs: durationOf(dragRef.current) });
  };
  const onTrackDrop = (e: DragEvent<HTMLDivElement>, tech: string) => {
    e.preventDefault();
    const p = dragRef.current;
    dragRef.current = null; setHover(null); setDragging(false);
    if (p) setPending({ payload: p, tech, start: timeFromEvent(e) });
  };
  const onDragEnd = () => { dragRef.current = null; setHover(null); setDragging(false); };

  const pendingWarnings = (pd: Pending): { tone: "red" | "amber" | "blue"; text: string; block?: boolean }[] => {
    const w: { tone: "red" | "amber" | "blue"; text: string; block?: boolean }[] = [];
    const prof = techProfile(pd.tech);
    const dur = durationOf(pd.payload);
    const avail = techAvailability(pd.tech, pd.start);
    if (avail === "On leave" || avail === "Off today") w.push({ tone: "red", text: `${pd.tech} is ${avail.toLowerCase()}.` });
    if (prof) {
      const h0 = new Date(pd.start).getHours() + new Date(pd.start).getMinutes() / 60;
      if (h0 < prof.shift[0] || h0 + dur / 3600000 > prof.shift[1]) w.push({ tone: "amber", text: `Outside ${pd.tech.split(" ")[0]}'s shift (${hourLabel(prof.shift[0])} – ${hourLabel(prof.shift[1])}).` });
    }
    const except = pd.payload.kind === "job" ? pd.payload.id : undefined;
    const clash = techBusy(pd.tech, pd.start, except).find(b => pd.start < b.end && pd.start + dur > b.start + travelMinutes(b.job) * 60000);
    if (clash) w.push({ tone: "red", text: `Overlaps ${clash.job.jobId} (${fmtTime(jobWindow(clash.job).start)}).` });
    const type = pd.payload.kind === "wo" ? workOrderById(pd.payload.id)?.serviceType : ALL_JOBS.find(j => j.id === pd.payload.id)?.serviceType;
    if (prof && type && !prof.skills.includes(type)) w.push({ tone: "amber", text: `${pd.tech.split(" ")[0]} isn't listed for ${type} work.` });
    const zone = pd.payload.kind === "wo" ? workOrderById(pd.payload.id)?.zone : ALL_JOBS.find(j => j.id === pd.payload.id)?.region;
    if (prof && zone && prof.zone !== zone) w.push({ tone: "blue", text: `Based in ${prof.zone} zone — expect longer travel to ${zone}.` });
    // Certification: blocks the assignment.
    const cert = type ? certProblem(pd.tech, type, pd.start) : null;
    if (cert) w.push({ tone: "red", text: cert, block: true });
    // Workload guardrails: overtime and back-to-back visits.
    const dayStart = startOfDay(pd.start);
    const own = pd.payload.kind === "job" ? ALL_JOBS.find(j => j.id === pd.payload.id) : undefined;
    const ownHours = own && own.technician === pd.tech && startOfDay(own.scheduledAt) === dayStart ? (jobWindow(own).end - jobWindow(own).start) / 3600000 : 0;
    const load = bookedHours(pd.tech, dayStart) - ownHours + dur / 3600000;
    if (load > 8) w.push({ tone: "amber", text: `${pd.tech.split(" ")[0]} would be booked ${load.toFixed(1).replace(".0", "")}h that day (over 8h).` });
    const near = techBusy(pd.tech, pd.start, except).find(b => b.end <= pd.start && pd.start - b.end < 30 * 60000 && !(pd.start < b.end));
    if (near && !clash) w.push({ tone: "amber", text: `Back-to-back with ${near.job.jobId}: only ${Math.round((pd.start - near.end) / 60000)} min between visits.` });
    return w;
  };

  // Notify-customer prompt after a visit is booked or moved. Uses the arrival window from Settings.
  const [winMins, setWinMins] = useState(120);
  const [ask, setAsk] = useState<{ customer: string; email: string; phone: string; channel: "email" | "sms" | "whatsapp"; subject: string; message: string } | null>(null);
  useEffect(() => { loadCerts().then(() => setVersion(v => v + 1)); fetch("/api/org").then(r => (r.ok ? r.json() : null)).then(o => { if (o?.arrivalWindowMins) setWinMins(o.arrivalWindowMins); }).catch(() => {}); }, []);
  const askToNotify = (customer: string, jobName: string, start: number) => {
    const cust = customerByName(customer);
    const when = `${weekday(start)}, ${fmtDate(start)} between ${fmtTime(start)} and ${fmtTime(start + winMins * 60000)}`;
    setAsk({ customer, email: cust?.email ?? "", phone: cust?.phone ?? "", channel: "email", subject: `Your visit is booked: ${jobName}`, message: `Hello,

Your service visit (${jobName}) is booked for ${when}. A technician will arrive within that window. Reply or call us if you need to change it.` });
  };
  const sendAsk = async () => {
    if (!ask) return;
    const res = await fetch("/api/notify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ channel: ask.channel, event: "appointment.booked", to: ask.channel === "email" ? ask.email : ask.phone, subject: ask.subject, message: ask.message }) });
    const d = await res.json().catch(() => ({}));
    notify(res.ok ? (d.status === "sent" ? `${ask.customer} was emailed` : "Recorded by the test provider. Read it in Settings, Delivery log. Nothing was sent.") : "Could not send the message", undefined, res.ok && d.status === "sent" ? "success" : "info");
    setAsk(null);
  };

  const confirmPending = () => {
    if (!pending) return;
    const { payload, tech, start } = pending;
    if (payload.kind === "wo") {
      const job = dispatchWorkOrder(payload.id, tech, start);
      if (job) askToNotify(job.customer, job.jobName, start);
      if (job) { setSel({ kind: "job", id: job.id }); notify(`${job.jobId} scheduled with ${tech} · ${fmtDay(start)}, ${fmtTime(start)}`, `/jobs/${job.id}`); }
    } else {
      const job = ALL_JOBS.find(j => j.id === payload.id);
      rescheduleJob(payload.id, tech, start);
      if (job && start !== jobWindow(job).start) askToNotify(job.customer, job.jobName, start);
      if (job) notify(`${job.jobId} moved to ${tech} · ${fmtTime(start)}`);
      setSel({ kind: "job", id: payload.id });
    }
    if (startOfDay(start) !== day) setDay(startOfDay(start));
    setPending(null); refresh();
  };

  // ── Queue card ──
  const renderQueueCard = (wo: WorkOrder) => {
    const Icon = SERVICE_ICON[wo.serviceType];
    const active = sel?.kind === "wo" && sel.id === wo.id;
    const wantsToday = wo.preferredDate && startOfDay(wo.preferredDate) <= startOfDay(JOBS_TODAY_TS);
    return (
      <div key={wo.id} draggable={isLG} onDragStart={e => onDragStart(e, { kind: "wo", id: wo.id })} onDragEnd={onDragEnd}
        role="button" tabIndex={0} onClick={() => setSel({ kind: "wo", id: wo.id })} onKeyDown={e => { if (e.key === "Enter") setSel({ kind: "wo", id: wo.id }); }}
        className={`group rounded-xl border px-3 py-2.5 bg-[var(--bg-card)] transition-colors ${isLG ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"} ${
          active ? "border-blue-500 ring-1 ring-blue-500" : "border-[var(--border)] hover:border-[var(--serviceops-primary)]"
        }`}>
        <div className="flex items-start gap-2">
          {isLG && <DotsSixVertical size={16} className="mt-0.5 flex-shrink-0 text-[var(--text-faint)] group-hover:text-[var(--text-muted)]" />}
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-caption font-semibold text-blue-600">{wo.number}</span>
              <PriorityTag priority={wo.priority} />
            </div>
            <p className="m-0 mt-0.5 text-label text-[var(--text-primary)] leading-snug">{wo.title}</p>
            <p className="m-0 text-caption text-[var(--text-muted)] truncate">{wo.customer}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-[var(--text-body)]">
              <span className="inline-flex items-center gap-1"><Icon size={13} weight="fill" />{wo.serviceType}</span>
              <span className="inline-flex items-center gap-1"><MapPin size={13} />{wo.zone}</span>
              <span className="inline-flex items-center gap-1"><HourglassMedium size={13} />{JOB_DURATION_HRS[wo.serviceType]}h</span>
              {wantsToday && <span className="inline-flex items-center gap-1 font-semibold text-[#D97706]"><Lightning size={13} weight="fill" />Wants today</span>}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ── Queue panel ──
  const queuePanel = (
    <Panel className="lg:h-full" title={queueTab === "queue" ? "To schedule" : "Needs attention"}
      right={<span className="text-caption text-[var(--text-muted)]">{queueTab === "queue" ? queue.length : alerts.length}</span>}>
      <div className="px-4 pb-3 flex-shrink-0">
        <Segmented size="sm" value={queueTab} onChange={setQueueTab}
          options={[{ value: "queue", label: "Work orders", count: queue.length }, { value: "attention", label: "Attention", count: alerts.length }]} />
      </div>
      <div className="flex-1 overflow-y-auto px-4 pb-4 flex flex-col gap-2 min-h-0">
        {queueTab === "queue" ? (
          <>
            {queue.length === 0 && (
              <div className="py-10 text-center text-body text-[var(--text-muted)]">
                <CheckCircle size={26} weight="duotone" className="mx-auto mb-2 text-[#16A34A]" />
                Everything ready has been scheduled.
              </div>
            )}
            {queue.map(renderQueueCard)}
            {notReady > 0 && (
              <Link href="/work-orders" className="mt-1 flex items-center gap-2 rounded-xl px-3 py-2.5 bg-[var(--serviceops-tint)] text-caption text-[var(--text-body)] hover:text-[var(--text-primary)]">
                <Info size={14} className="flex-shrink-0" />
                {notReady} more waiting on review or customer approval
                <CaretRight size={12} className="ml-auto" />
              </Link>
            )}
            {isLG && queue.length > 0 && <p className="m-0 mt-1 text-caption text-[var(--text-faint)] text-center">Drag a card onto a technician&apos;s row to schedule it</p>}
          </>
        ) : (
          <>
            {alerts.length === 0 && <div className="py-10 text-center text-body text-[var(--text-muted)]">No conflicts in the next 4 days.</div>}
            {alerts.map(a => (
              <button key={a.job.id} type="button" onClick={() => { setSel({ kind: "job", id: a.job.id }); setDay(startOfDay(a.job.scheduledAt)); setMobilePane("schedule"); }}
                className={`text-left rounded-xl border px-3 py-2.5 transition-colors ${sel?.kind === "job" && sel.id === a.job.id ? "border-blue-500 ring-1 ring-blue-500" : "border-[var(--border)] hover:border-[var(--serviceops-primary)]"}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-caption font-semibold text-blue-600">{a.job.jobId}</span>
                  <span className="text-caption text-[var(--text-muted)]">{weekday(a.job.scheduledAt)} {fmtDay(a.job.scheduledAt)}, {a.job.scheduledTime}</span>
                </div>
                <p className="m-0 mt-0.5 text-label text-[var(--text-primary)]">{a.job.jobName} · {a.job.customer}</p>
                <p className="m-0 mt-1 inline-flex items-center gap-1.5 text-caption font-medium" style={{ color: a.tone === "red" ? "#EF4444" : "#D97706" }}>
                  <WarningCircle size={14} weight="fill" /> {a.reason}
                </p>
              </button>
            ))}
          </>
        )}
      </div>
    </Panel>
  );

  // ── Timeline ──
  const nowPct = isToday ? pct(DATASET_CLOCK, day) : -1;
  const timeline = (
    <div className="flex-1 overflow-auto min-h-0">
      <div className="min-w-[860px]">
        {/* Hour scale */}
        <div className="sticky top-0 z-20 flex bg-[var(--bg-card)] border-b border-[var(--border-soft)]">
          <div className="w-[150px] sm:w-[200px] flex-shrink-0 sticky left-0 z-10 bg-[var(--bg-card)] px-3 sm:px-4 py-2 text-caption text-[var(--text-muted)]">Technician</div>
          <div className="flex-1 relative flex">
            {HOURS.map(h => <div key={h} className="flex-1 py-2 pl-1.5 text-caption text-[var(--text-muted)] border-l border-[var(--border-soft)]">{hourLabel(h)}</div>)}
          </div>
        </div>

        {techs.map(t => {
          const avail = techAvailability(t.name, day);
          const away = avail === "On leave" || avail === "Off today";
          const jobs = dayJobs.filter(j => j.technician === t.name);
          const hours = bookedHours(t.name, day);
          const cap = t.shift[1] - t.shift[0];
          const rowSelected = sel?.kind === "tech" && sel.name === t.name;
          return (
            <div key={t.name} className={`flex border-b border-[var(--border-soft)] ${rowSelected ? "bg-[var(--serviceops-primary-10)]" : ""}`}>
              <button type="button" onClick={() => setSel({ kind: "tech", name: t.name })}
                className="w-[150px] sm:w-[200px] flex-shrink-0 sticky left-0 z-10 bg-[var(--bg-card)] flex items-center gap-2.5 px-3 sm:px-4 py-2.5 text-left hover:bg-[var(--serviceops-tint)] border-r border-[var(--border-soft)]">
                <Avatar src={t.avatar} alt={t.name} sx={{ width: 32, height: 32, opacity: away ? 0.5 : 1 }} />
                <span className="min-w-0 flex-1">
                  <span className="block text-body font-semibold text-[var(--text-primary)] truncate">{t.name}</span>
                  <span className="block text-caption text-[var(--text-muted)] truncate">
                    {away ? avail : `${t.zone} · ${hours.toFixed(1).replace(".0", "")}/${cap}h`}
                  </span>
                </span>
                {!away && (
                  <span className="w-1.5 h-8 rounded-full bg-[var(--border-soft)] overflow-hidden flex flex-col-reverse flex-shrink-0" title={`${Math.round((hours / cap) * 100)}% booked`}>
                    <span className="w-full rounded-full" style={{ height: `${Math.min(100, (hours / cap) * 100)}%`, backgroundColor: hours / cap > 0.85 ? "#EF4444" : hours / cap > 0.6 ? "#F59E0B" : "#16A34A" }} />
                  </span>
                )}
              </button>

              <div className="flex-1 relative h-[64px]" data-tech={t.name}
                onDragOver={e => onTrackOver(e, t.name)} onDragLeave={() => setHover(h => (h?.tech === t.name ? null : h))} onDrop={e => onTrackDrop(e, t.name)}>
                {/* Hour grid + off-shift shading */}
                <div className="absolute inset-0 flex pointer-events-none">
                  {HOURS.map(h => (
                    <div key={h} className="flex-1 border-l border-[var(--border-soft)]"
                      style={{ backgroundColor: away || h < t.shift[0] || h >= t.shift[1] ? (isDark ? "rgba(255,255,255,0.025)" : "rgba(17,17,17,0.025)") : undefined }} />
                  ))}
                </div>
                {away && (
                  <div className="absolute inset-0 flex items-center justify-center text-caption text-[var(--text-muted)] pointer-events-none"
                    style={{ backgroundImage: `repeating-linear-gradient(135deg, transparent 0 8px, ${isDark ? "rgba(255,255,255,0.04)" : "rgba(17,17,17,0.04)"} 8px 16px)` }}>
                    {avail}
                  </div>
                )}
                {nowPct >= 0 && nowPct <= 100 && <div className="absolute top-0 bottom-0 w-[2px] bg-[#EF4444] z-[5] pointer-events-none" style={{ left: `${nowPct}%` }} />}

                {jobs.map(j => {
                  const w = jobWindow(j);
                  const left = pct(w.start, day), width = ((w.end - w.start) / SPAN_MS) * 100;
                  const travelW = ((travelMinutes(j) * 60000) / SPAN_MS) * 100;
                  const m = STATUS_META[j.status];
                  const color = isDark ? m.dark : m.light;
                  const selected = sel?.kind === "job" && sel.id === j.id;
                  const alert = j.slaBreached || j.status === "Incomplete" || away;
                  const movable = isLG && !["Completed", "Cancelled", "On site"].includes(j.status);
                  return (
                    <div key={j.id}>
                      <Tooltip title={`Travel ~${travelMinutes(j)} min`} placement="top">
                        <div className="absolute top-[22px] h-[20px] rounded-l-md" style={{
                          left: `${left - travelW}%`, width: `${travelW}%`,
                          backgroundImage: `repeating-linear-gradient(135deg, ${color}33 0 4px, transparent 4px 8px)`,
                        }} />
                      </Tooltip>
                      <div draggable={movable} onDragStart={e => onDragStart(e, { kind: "job", id: j.id })} onDragEnd={onDragEnd}
                        role="button" tabIndex={0} onClick={() => setSel({ kind: "job", id: j.id })} onKeyDown={e => { if (e.key === "Enter") setSel({ kind: "job", id: j.id }); }}
                        className={`absolute top-[8px] h-[48px] rounded-lg px-2 py-1 overflow-hidden text-left transition-shadow z-[6] ${movable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"} ${selected ? "ring-2 ring-blue-500 shadow-md" : "hover:shadow-md"}`}
                        style={{ left: `${left}%`, width: `${Math.max(width, 2)}%`, backgroundColor: isDark ? m.bgDark : m.bgLight, borderLeft: `3px solid ${color}`, opacity: j.status === "Cancelled" ? 0.55 : 1 }}>
                        <p className="m-0 flex items-center gap-1 text-caption font-semibold text-[var(--text-primary)] truncate">
                          {alert && <WarningCircle size={12} weight="fill" color="#EF4444" className="flex-shrink-0" />}
                          {j.jobId}
                        </p>
                        <p className="m-0 text-[11px] leading-4 text-[var(--text-body)] truncate">{j.customer}</p>
                        <p className="m-0 text-[11px] leading-4 text-[var(--text-muted)] truncate">{fmtTime(w.start)} · {j.status}</p>
                      </div>
                    </div>
                  );
                })}

                {hover?.tech === t.name && (
                  <div className="absolute top-[6px] h-[52px] rounded-lg border-2 border-dashed border-blue-500 bg-blue-500/10 z-[7] pointer-events-none flex items-start px-2 py-1"
                    style={{ left: `${pct(hover.start, day)}%`, width: `${(hover.durMs / SPAN_MS) * 100}%` }}>
                    <span className="text-[11px] font-semibold text-blue-600">{fmtTime(hover.start)}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {techs.length === 0 && <p className="m-0 py-10 text-center text-body text-[var(--text-muted)]">No technicians in this zone.</p>}
      </div>
    </div>
  );

  // ── Live map ──
  const applyRoute = (tech: string, times: { id: number; start: number }[]) => {
    times.forEach(t => rescheduleJob(t.id, tech, t.start));
    refresh();
    notify(`${tech}'s route reordered (${times.length} visits). Customers have not been told; update them from each job.`);
  };
  const map = <DispatchMap jobs={dayJobs} queue={queue} selId={sel} zoneOk={zoneOk} isDark={isDark} onSelect={setSel} onApply={applyRoute} />;

  const schedulePanel = (
    <Panel className="lg:h-full flex-1 min-w-0" title={
      <span className="inline-flex items-center gap-2">
        <IconButton size="small" aria-label="Previous day" onClick={() => setDay(d => d - DAY_MS)}><CaretLeft size={16} weight="bold" /></IconButton>
        <span className="whitespace-nowrap">{weekday(day)}, {fmtDate(day)}</span>
        <IconButton size="small" aria-label="Next day" onClick={() => setDay(d => d + DAY_MS)}><CaretRight size={16} weight="bold" /></IconButton>
        {!isToday && <Button size="small" onClick={() => setDay(startOfDay(JOBS_TODAY_TS))}>Today</Button>}
      </span>
    } right={<span className="flex items-center gap-2"><button type="button" aria-pressed={showLoad} onClick={() => { setShowLoad(v => !v); setSel(null); }} className={`h-8 px-3 rounded-[10px] text-[13px] font-semibold border ${showLoad ? "border-[var(--serviceops-primary)] bg-[var(--serviceops-primary-10)]" : "border-[var(--border)]"} text-[var(--text-primary)]`}>Workload</button><Segmented size="sm" value={view} onChange={setView} options={[{ value: "timeline", label: "Timeline" }, { value: "map", label: "Map" }]} /></span>}>
      {view === "timeline" ? timeline : map}
    </Panel>
  );

  // ── Details ──
  const assignControls = (opts: { tech: string; start: number | null; label: string }) => (
    <AssignForm key={`${sel?.kind}-${sel && "id" in sel ? sel.id : ""}-${day}`} day={day} defaultTech={opts.tech} defaultStart={opts.start} label={opts.label}
      onAssign={(tech, start) => setPending({ payload: selWO ? { kind: "wo", id: selWO.id } : { kind: "job", id: selJob!.id }, tech, start })} />
  );

  let details: ReactNode = null;
  if (selWO) {
    const ranked = suggestTechnicians(selWO, day);
    const cust = customerById(selWO.customerId);
    const dur = JOB_DURATION_HRS[selWO.serviceType] * 3600000;
    details = (
      <div className="flex flex-col gap-4">
        <div>
          <div className="flex items-center justify-between gap-2">
            <Link href={`/work-orders/${selWO.id}`} className="text-caption font-semibold text-blue-600 hover:underline">{selWO.number}</Link>
            <PriorityTag priority={selWO.priority} />
          </div>
          <p className="m-0 mt-1 text-label text-[var(--text-primary)]">{selWO.title}</p>
          <p className="m-0 text-caption text-[var(--text-muted)]">{selWO.customer} · {cust?.location}</p>
          <p className="m-0 mt-2 text-body text-[var(--text-body)] line-clamp-4">{selWO.description}</p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-caption text-[var(--text-body)]">
            <span className="inline-flex items-center gap-1"><MapPin size={13} />{selWO.zone} zone</span>
            <span className="inline-flex items-center gap-1"><HourglassMedium size={13} />{dur / 3600000}h on site</span>
            <span className="inline-flex items-center gap-1"><CalendarBlank size={13} />{selWO.preferredDate ? `Wants ${fmtDay(selWO.preferredDate)}` : "Flexible"}</span>
          </div>
        </div>

        <div>
          <p className="m-0 mb-2 inline-flex items-center gap-1.5 text-caption font-semibold uppercase tracking-wide text-[var(--text-muted)]"><Sparkle size={13} weight="fill" />Best fit · {fmtDay(day)}</p>
          <div className="flex flex-col gap-2">
            {ranked.slice(0, 4).map((s, i) => (
              <div key={s.tech.name} className={`rounded-xl border px-3 py-2.5 ${i === 0 ? "border-blue-500/50 bg-blue-500/5" : "border-[var(--border)]"}`}>
                <div className="flex items-center gap-2.5">
                  <Avatar src={s.tech.avatar} sx={{ width: 30, height: 30 }} />
                  <div className="min-w-0 flex-1">
                    <p className="m-0 text-body font-semibold text-[var(--text-primary)] truncate">{s.tech.name}</p>
                    <p className="m-0 text-caption text-[var(--text-muted)] truncate">
                      {s.skill ? `${selWO.serviceType} skilled` : "Not skill-matched"} · {s.zone ? "same zone" : `${s.tech.zone} zone`} · {s.hours.toFixed(1).replace(".0", "")}h booked
                    </p>
                  </div>
                  {s.slot
                    ? <Button size="small" variant={i === 0 ? "contained" : "outlined"} onClick={() => setPending({ payload: { kind: "wo", id: selWO.id }, tech: s.tech.name, start: s.slot! })} sx={{ whiteSpace: "nowrap", px: 1.5, py: 0.5 }}>{fmtTime(s.slot)}</Button>
                    : <span className="text-caption text-[var(--text-muted)]">Full</span>}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="pt-3 border-t border-[var(--border-soft)]">
          <p className="m-0 mb-2 text-caption font-semibold uppercase tracking-wide text-[var(--text-muted)]">Or choose</p>
          {assignControls({ tech: ranked[0]?.tech.name ?? TECH_PROFILES[0].name, start: ranked[0]?.slot ?? null, label: "Schedule" })}
        </div>
      </div>
    );
  } else if (selJob) {
    const w = jobWindow(selJob);
    const wo = workOrderForJob(selJob.id);
    const prof = techProfile(selJob.technician);
    const away = techAvailability(selJob.technician, selJob.scheduledAt);
    const locked = ["Completed", "Cancelled"].includes(selJob.status);
    details = (
      <div className="flex flex-col gap-4">
        <div>
          <div className="flex items-center justify-between gap-2">
            <Link href={`/jobs/${selJob.id}`} className="text-label font-semibold text-blue-600 hover:underline">{selJob.jobId}</Link>
            <JobStatusPill status={selJob.status} />
          </div>
          <p className="m-0 mt-1 text-label text-[var(--text-primary)]">{selJob.jobName}</p>
          <p className="m-0 text-caption text-[var(--text-muted)]">{selJob.customer} · {selJob.location}</p>
          {wo && <p className="m-0 mt-1 text-caption text-[var(--text-muted)]">From <Link href={`/work-orders/${wo.id}`} className="text-blue-600 hover:underline">{wo.number}</Link></p>}
        </div>
        {(selJob.slaBreached || selJob.status === "Incomplete" || away === "On leave") && (
          <div className="flex items-start gap-2 rounded-xl px-3 py-2 bg-[rgba(239,68,68,0.08)]">
            <WarningCircle size={16} weight="fill" color="#EF4444" className="mt-0.5 flex-shrink-0" />
            <span className="text-body text-[var(--text-primary)]">
              {away === "On leave" ? `${selJob.technician} is on leave — reassign this visit.` : selJob.slaBreached ? `SLA breached (${selJob.slaHours}h response).` : "Visit incomplete — book a return visit."}
            </span>
          </div>
        )}
        <dl className="m-0 flex flex-col gap-2">
          {[
            [Clock, "Window", `${fmtTime(w.start)} – ${fmtTime(w.end)}`],
            [Path, "Travel", `~${travelMinutes(selJob)} min from depot`],
            [Flag, "Priority", selJob.priority],
            [MapPin, "Zone", selJob.region],
          ].map(([Icon, label, val]) => {
            const I = Icon as typeof Clock;
            return (
              <div key={label as string} className="grid grid-cols-[18px_80px_minmax(0,1fr)] items-center gap-x-2">
                <I size={16} className="text-blue-600" />
                <dt className="text-caption text-[var(--text-muted)]">{label as string}</dt>
                <dd className="m-0 text-body text-[var(--text-primary)]">{val as string}</dd>
              </div>
            );
          })}
        </dl>
        <div className="flex items-center gap-2.5 rounded-xl border border-[var(--border-soft)] px-3 py-2.5">
          <Avatar src={prof?.avatar} sx={{ width: 34, height: 34 }} />
          <div className="min-w-0 flex-1">
            <p className="m-0 text-body font-semibold text-[var(--text-primary)] truncate">{selJob.technician}</p>
            <p className="m-0 text-caption text-[var(--text-muted)] truncate">{prof?.title} · {away}</p>
          </div>
          {prof && <IconButton size="small" aria-label={`Call ${selJob.technician}`} href={`tel:${prof.phone.replace(/\s/g, "")}`}><Phone size={16} /></IconButton>}
        </div>
        {!locked ? (
          <div className="pt-3 border-t border-[var(--border-soft)]">
            <p className="m-0 mb-2 text-caption font-semibold uppercase tracking-wide text-[var(--text-muted)]">Reassign or reschedule</p>
            {assignControls({ tech: selJob.technician, start: w.start, label: "Update" })}
          </div>
        ) : <p className="m-0 text-caption text-[var(--text-muted)]">{selJob.status} jobs can&apos;t be moved.</p>}
        <Button variant="outlined" endIcon={<ArrowSquareOut size={14} />} onClick={() => router.push(`/jobs/${selJob.id}`)}>Open job</Button>
      </div>
    );
  } else if (selTech) {
    const jobs = dayJobs.filter(j => j.technician === selTech.name).sort((a, b) => a.scheduledAt - b.scheduledAt);
    const avail = techAvailability(selTech.name, day);
    const hours = bookedHours(selTech.name, day);
    const free = nextFreeSlot(selTech.name, day, 2 * 3600000);
    details = (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <Avatar src={selTech.avatar} sx={{ width: 48, height: 48 }} />
          <div className="min-w-0">
            <p className="m-0 text-label font-bold text-[var(--text-primary)]">{selTech.name}</p>
            <p className="m-0 text-caption text-[var(--text-muted)]">{selTech.title} · {selTech.zone} zone</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2"><Pill tone={AVAIL_TONE[avail]}>{avail}</Pill><Pill tone="gray" dot={false}>Shift {hourLabel(selTech.shift[0])} – {hourLabel(selTech.shift[1])}</Pill></div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-[var(--serviceops-tint)] px-3 py-2"><p className="m-0 text-caption text-[var(--text-muted)]">Booked</p><p className="m-0 text-h2 font-bold text-[var(--text-primary)]">{hours.toFixed(1).replace(".0", "")} / {selTech.shift[1] - selTech.shift[0]}h</p></div>
          <div className="rounded-xl bg-[var(--serviceops-tint)] px-3 py-2"><p className="m-0 text-caption text-[var(--text-muted)]">Next 2h gap</p><p className="m-0 text-h2 font-bold text-[var(--text-primary)]">{free ? fmtTime(free) : "None"}</p></div>
        </div>
        <div>
          <p className="m-0 mb-1.5 text-caption font-semibold uppercase tracking-wide text-[var(--text-muted)]">Skills</p>
          <div className="flex flex-wrap gap-1.5">{selTech.skills.map(s => <Pill key={s} tone="blue" dot={false}>{s}</Pill>)}</div>
        </div>
        <div>
          <p className="m-0 mb-1.5 text-caption font-semibold uppercase tracking-wide text-[var(--text-muted)]">{fmtDay(day)} · {jobs.length} job{jobs.length === 1 ? "" : "s"}</p>
          {jobs.length === 0 ? <p className="m-0 text-body text-[var(--text-muted)]">Nothing booked.</p> : (
            <ul className="m-0 p-0 list-none flex flex-col gap-1.5">
              {jobs.map(j => (
                <li key={j.id}>
                  <button type="button" onClick={() => setSel({ kind: "job", id: j.id })} className="w-full flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 hover:bg-[var(--serviceops-tint)] text-left">
                    <span className="min-w-0"><span className="block text-body text-[var(--text-primary)] truncate">{j.scheduledTime} · {j.customer}</span><span className="block text-caption text-[var(--text-muted)]">{j.jobId} · {j.jobName}</span></span>
                    <JobStatusPill status={j.status} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <Button variant="outlined" startIcon={<Phone size={14} />} href={`tel:${selTech.phone.replace(/\s/g, "")}`}>{selTech.phone}</Button>
      </div>
    );
  }

  // Nothing selected: show how evenly the day is spread across technicians who are working.
  if (!details) {
    const rows = TECH_PROFILES.filter(t => !["On leave", "Off today"].includes(techAvailability(t.name, day))).map(t => ({ name: t.name, h: bookedHours(t.name, day) }));
    const avg = rows.length ? rows.reduce((s, r) => s + r.h, 0) / rows.length : 0;
    const max = Math.max(8, ...rows.map(r => r.h));
    details = (
      <div className="flex flex-col gap-3">
        <p className="m-0 text-caption text-[var(--text-muted)]">{fmtDay(day)} · average {avg.toFixed(1).replace(".0", "")}h booked per available technician. The line marks 8 hours.</p>
        <ul className="m-0 p-0 list-none flex flex-col gap-2.5">
          {rows.sort((a, b) => b.h - a.h).map(r => {
            const over = r.h > 8, light = avg > 0 && r.h < avg * 0.5;
            return (
              <li key={r.name} className="text-[13px]">
                <div className="flex justify-between gap-2"><span className="text-[var(--text-primary)] truncate">{r.name}</span>
                  <span className="whitespace-nowrap" style={{ color: over ? "#DC2626" : light ? "#2563EB" : "var(--text-body)" }}>{r.h.toFixed(1).replace(".0", "")}h{over ? " · over" : light ? " · light" : ""}</span></div>
                <div className="relative h-2 mt-1 rounded-full bg-[var(--serviceops-tint)]">
                  <div className="h-full rounded-full" style={{ width: `${(r.h / max) * 100}%`, background: over ? "#EF4444" : "var(--serviceops-primary)" }} />
                  <span className="absolute top-[-2px] h-3 w-px bg-[var(--text-muted)]" style={{ left: `${(8 / max) * 100}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
        <p className="m-0 text-caption text-[var(--text-muted)]">Drag work onto the lightest day first. Pick a technician or a job to see details.</p>
      </div>
    );
  }

  const detailTitle = selWO ? "Schedule work order" : selJob ? "Job" : sel ? "Technician" : "Team workload";
  const detailsPanel = (
    <Panel className="h-full !shadow-[0_12px_40px_rgba(17,17,17,0.16)]" title={detailTitle} right={sel || showLoad ? <IconButton size="small" aria-label="Close panel" onClick={() => { setSel(null); setShowLoad(false); }}><X size={16} /></IconButton> : undefined}>
      <div className="flex-1 overflow-y-auto px-4 pb-4 min-h-0">{details}</div>
    </Panel>
  );

  const pendingWO = pending?.payload.kind === "wo" ? workOrderById(pending.payload.id) : undefined;
  const pendingJob = pending?.payload.kind === "job" ? ALL_JOBS.find(j => j.id === pending.payload.id) : undefined;
  const pendingDur = pending ? durationOf(pending.payload) : 0;
  const warnings = pending ? pendingWarnings(pending) : [];

  return (
    <div className="sidebar-content flex-1 flex flex-col min-h-screen lg:h-screen lg:min-h-0 lg:overflow-hidden">
      <main className="flex-1 min-h-0 flex flex-col px-4 sm:px-6 lg:px-8 py-4 sm:py-5 gap-4 animate-fade-in min-w-0 lg:overflow-y-auto">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
          <div className="min-w-0">
            <Breadcrumb items={[{ label: "Dispatch" }]} />
            <h1 className="m-0 mt-2 text-display font-bold tracking-tight text-[var(--text-primary)]">Dispatch</h1>
            <p className="m-0 mt-0.5 text-body text-[var(--text-body)]">
              {isToday ? "Today" : fmtDay(day)}: {stats.scheduled} visits booked · {stats.moving} in the field · {stats.free} of {TECH_PROFILES.length} technicians free
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {alerts.length > 0 && (
              <button type="button" onClick={() => { setQueueTab("attention"); setMobilePane("queue"); }}
                className="inline-flex items-center gap-1.5 h-9 rounded-full px-3 text-button-sm font-semibold bg-[rgba(239,68,68,0.12)] text-[var(--text-primary)]">
                <WarningCircle size={15} weight="fill" color="#EF4444" />{alerts.length} need attention
              </button>
            )}
            <button type="button" onClick={() => { setQueueTab("queue"); setMobilePane("queue"); }}
              className="inline-flex items-center gap-1.5 h-9 rounded-full px-3 text-button-sm font-semibold bg-[var(--serviceops-primary-10)] text-[var(--text-primary)]">
              <ClipboardText size={15} weight="fill" color="#F59E0B" />{queue.length} to schedule
            </button>
            <FilterSelect value={zoneF} options={["All zones", ...SERVICE_ZONES]} onChange={setZoneF} icon={<MapPin size={16} className="text-[var(--text-body)]" />} className="!h-9 w-[150px]" />
          </div>
        </div>

        {!isLG && (
          <Segmented value={mobilePane} onChange={setMobilePane}
            options={[{ value: "queue", label: "Queue", count: queue.length + alerts.length }, { value: "schedule", label: "Schedule" }]} />
        )}

        {isLG ? (
          <div className="grid gap-4 flex-1 grid-cols-[290px_minmax(0,1fr)]" style={{ minHeight: 480 }}>
            {queuePanel}
            {/* Details float over the late-day hours only while something is selected, so the schedule keeps its width */}
            <div className="relative min-w-0 min-h-0 flex">
              {schedulePanel}
              {(sel || showLoad) && !dragging && <div className="absolute top-0 right-0 bottom-0 w-[350px] max-w-[85%] z-30 flex">{detailsPanel}</div>}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">{mobilePane === "queue" ? queuePanel : <div className="h-[calc(100vh-260px)] min-h-[420px] flex">{schedulePanel}</div>}</div>
        )}
      </main>

      {/* Phones and tablets: details come up as a bottom sheet */}
      {!isLG && (
        <Drawer anchor="bottom" open={!!sel} onClose={() => setSel(null)}
          PaperProps={{ sx: { width: "100%", maxHeight: "85vh", borderTopLeftRadius: 16, borderTopRightRadius: 16, bgcolor: "var(--bg-card)" } }}>
          <div className="flex flex-col h-full py-2">{detailsPanel}</div>
        </Drawer>
      )}

      {/* Confirm every drop — dispatch changes reach a technician's phone */}
      <Dialog open={!!pending} onClose={() => setPending(null)} maxWidth="xs" fullWidth>
        {pending && (
          <div className="p-5 flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <span className="w-10 h-10 rounded-xl bg-[var(--serviceops-primary-10)] flex items-center justify-center flex-shrink-0"><UserSwitch size={20} weight="duotone" color="#D97706" /></span>
              <div className="min-w-0">
                <h2 className="m-0 text-h2 font-bold text-[var(--text-primary)]">{pendingWO ? "Schedule work order" : "Move job"}</h2>
                <p className="m-0 text-body text-[var(--text-body)]">{pendingWO ? `${pendingWO.number} · ${pendingWO.title}` : `${pendingJob?.jobId} · ${pendingJob?.jobName}`}</p>
              </div>
            </div>
            <div className="rounded-xl bg-[var(--serviceops-tint)] px-4 py-3 flex flex-col gap-1.5">
              <div className="flex items-center gap-2.5">
                <Avatar src={techProfile(pending.tech)?.avatar} sx={{ width: 28, height: 28 }} />
                <span className="text-label text-[var(--text-primary)]">{pending.tech}</span>
              </div>
              <p className="m-0 text-body text-[var(--text-body)]">{weekday(pending.start)}, {fmtDate(pending.start)} · {fmtTime(pending.start)} – {fmtTime(pending.start + pendingDur)}</p>
            </div>
            {warnings.length > 0 && (
              <ul className="m-0 p-0 list-none flex flex-col gap-1.5">
                {warnings.map((w, i) => (
                  <li key={i} className="flex items-start gap-2 text-body" style={{ color: w.tone === "red" ? "#DC2626" : w.tone === "amber" ? "#B45309" : "var(--text-body)" }}>
                    {w.tone === "blue" ? <Info size={16} className="mt-0.5 flex-shrink-0" /> : <WarningCircle size={16} weight="fill" className="mt-0.5 flex-shrink-0" />}
                    {w.text}
                  </li>
                ))}
              </ul>
            )}
            <p className="m-0 text-caption text-[var(--text-muted)]">{pending.tech.split(" ")[0]} gets the update on the ServiceOps mobile app.</p>
            <div className="flex justify-end gap-2">
              <Button onClick={() => setPending(null)} sx={{ color: "var(--text-muted)" }}>Cancel</Button>
              <Button variant="contained" onClick={confirmPending} disabled={warnings.some(w => w.block)}>{warnings.some(w => w.block) ? "Not allowed" : warnings.some(w => w.tone === "red") ? "Schedule anyway" : pendingWO ? "Schedule" : "Move job"}</Button>
            </div>
          </div>
        )}
      </Dialog>

      <Dialog open={!!ask} onClose={() => setAsk(null)} maxWidth="xs" fullWidth>
        {ask && (
          <div className="p-5 flex flex-col gap-3">
            <h2 className="m-0 text-h2 font-bold text-[var(--text-primary)]">Notify {ask.customer}?</h2>
            <div className="flex items-center gap-2"><select aria-label="Channel" className="h-9 px-3 rounded-[10px] text-[13px] border-[1.5px] border-[var(--serviceops-soft)] bg-[var(--bg-card)]" value={ask.channel} onChange={e => setAsk({ ...ask, channel: e.target.value as "email" | "sms" | "whatsapp" })}><option value="email">Email</option><option value="sms">SMS</option><option value="whatsapp">WhatsApp</option></select><span className="text-body text-[var(--text-body)]">to {(ask.channel === "email" ? ask.email : ask.phone) || "(no contact on file)"}</span></div>
            <textarea aria-label="Message to customer" rows={5} value={ask.message} onChange={e => setAsk({ ...ask, message: e.target.value })} className="w-full rounded-[10px] border-[1.5px] border-[var(--serviceops-soft)] bg-[var(--bg-card)] p-2.5 text-[13px] text-[var(--text-primary)]" />
            <div className="flex justify-end gap-2"><Button onClick={() => setAsk(null)} sx={{ color: "var(--text-muted)" }}>Skip</Button><Button variant="contained" onClick={sendAsk}>Send</Button></div>
          </div>
        )}
      </Dialog>

      {toastNode}
    </div>
  );
}

/** Technician + start time picker — the non-drag way to schedule (touch, keyboard). */
function AssignForm({ day, defaultTech, defaultStart, label, onAssign }: {
  day: number; defaultTech: string; defaultStart: number | null; label: string; onAssign: (tech: string, start: number) => void;
}) {
  const slots = Array.from({ length: (END_H - START_H) * 2 - 1 }, (_, i) => day + START_H * 3600000 + i * SLOT_MS);
  const [tech, setTech] = useState(defaultTech);
  const [start, setStart] = useState<number>(defaultStart && slots.includes(defaultStart) ? defaultStart : slots[4]);
  const selSx = { fontSize: "14px", borderRadius: "10px", "& .MuiSelect-select": { py: 1 } };
  return (
    <div className="flex flex-col gap-2">
      <Select size="small" value={tech} onChange={e => setTech(e.target.value)} sx={selSx} aria-label="Technician">
        {TECH_PROFILES.map(t => {
          const a = techAvailability(t.name, day);
          return <MenuItem key={t.name} value={t.name} sx={{ fontSize: "14px" }}>{t.name}{a !== "Available" && a !== "On job" ? ` — ${a.toLowerCase()}` : ""}</MenuItem>;
        })}
      </Select>
      <div className="flex gap-2">
        <Select size="small" value={start} onChange={e => setStart(Number(e.target.value))} sx={{ ...selSx, flex: 1 }} aria-label="Start time">
          {slots.map(s => <MenuItem key={s} value={s} sx={{ fontSize: "14px" }}>{fmtTime(s)}</MenuItem>)}
        </Select>
        <Button variant="contained" onClick={() => onAssign(tech, start)}>{label}</Button>
      </div>
    </div>
  );
}
