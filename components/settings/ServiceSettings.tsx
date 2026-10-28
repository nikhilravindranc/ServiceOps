"use client";
import { ReactNode, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import Button from "@mui/material/Button";
import {
  Buildings, Clock, Hash, Wrench, ListChecks, Flag, Timer, MapTrifold, UsersThree, Bell, FileText, SquaresFour, ShieldCheck,
  Plus, PencilSimple, DotsSixVertical,
} from "@phosphor-icons/react";
import { PageShell, PageHeader, MiniTable, Pill, SERVICE_ICON, useToast, Segmented } from "@/components/ui/ServiceOpsUI";
import { CARD_SHADOW } from "@/components/dashboard/DashboardSection";
import { useJobFieldSx } from "@/components/jobs/jobFormStyles";
import { CustomizeHomepagePanel, PermissionPanel, RolesPanel } from "@/components/settings/LegacySettings";
import { SERVICE_TYPE_ORDER, STATUS_ORDER, STATUS_META, PRIORITY_META, SLA_HOURS_BY_SERVICE, type JobStatus } from "@/lib/jobsData";
import { SERVICE_ZONES, TECH_PROFILES, CUSTOMERS, USERS, JOB_DURATION_HRS } from "@/lib/serviceData";
import { useTheme } from "@/components/ThemeContext";

type Key = "general" | "hours" | "numbering" | "types" | "statuses" | "priorities" | "sla" | "zones" | "teams" | "notifications" | "templates" | "homepage" | "permission";
const NAV: { group: string; items: { key: Key; label: string; icon: typeof Buildings; hint: string }[] }[] = [
  { group: "Organization", items: [
    { key: "general", label: "General", icon: Buildings, hint: "Company details, time zone, currency" },
    { key: "hours", label: "Business hours", icon: Clock, hint: "Working week and holidays" },
    { key: "numbering", label: "Numbering", icon: Hash, hint: "Prefixes for records" },
  ] },
  { group: "Service setup", items: [
    { key: "types", label: "Service types", icon: Wrench, hint: "Durations, skills, checklists" },
    { key: "statuses", label: "Job statuses", icon: ListChecks, hint: "The job lifecycle" },
    { key: "priorities", label: "Priorities", icon: Flag, hint: "Urgency levels" },
    { key: "sla", label: "SLA", icon: Timer, hint: "Response and resolution targets" },
    { key: "zones", label: "Service zones", icon: MapTrifold, hint: "Dispatch regions" },
    { key: "teams", label: "Teams", icon: UsersThree, hint: "Groups of technicians and staff" },
  ] },
  { group: "Communication", items: [
    { key: "notifications", label: "Notifications", icon: Bell, hint: "Who hears about what" },
    { key: "templates", label: "Templates", icon: FileText, hint: "Job cards, reports, messages" },
  ] },
  { group: "Access & workspace", items: [
    { key: "permission", label: "Roles & permissions", icon: ShieldCheck, hint: "What each role can do" },
    { key: "homepage", label: "Dashboards", icon: SquaresFour, hint: "Home page layouts" },
  ] },
];
const ALL = NAV.flatMap(g => g.items);
// Old CRM links (?tab=roles) still land somewhere sensible.
const ALIASES: Record<string, Key> = { roles: "permission", users: "general", organization: "general", personal: "general" };

function Panel({ title, description, action, children }: { title: string; description: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-4 sm:p-6 min-w-0" style={{ boxShadow: CARD_SHADOW }}>
      <header className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-5">
        <div>
          <h2 className="m-0 text-h1 font-bold text-[var(--text-primary)]">{title}</h2>
          <p className="m-0 mt-0.5 text-body text-[var(--text-body)]">{description}</p>
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[240px_minmax(0,1fr)] gap-2 sm:gap-6 py-4 border-b border-[var(--border-soft)] last:border-b-0 items-center">
      <div><p className="m-0 text-label text-[var(--text-primary)]">{label}</p>{hint && <p className="m-0 text-caption text-[var(--text-muted)]">{hint}</p>}</div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

const switchSx = { "& .MuiSwitch-switchBase.Mui-checked": { color: "#F59E0B" }, "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": { backgroundColor: "#F59E0B" } };

export default function ServiceSettings() {
  const router = useRouter();
  const params = useSearchParams();
  const FX = useJobFieldSx();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const { toastNode, notify } = useToast();
  const resolve = (t: string | null): Key => (t && (ALL.some(i => i.key === t) ? (t as Key) : ALIASES[t])) || "general";
  const [active, setActive] = useState<Key>(() => resolve(params.get("tab")));
  useEffect(() => { setActive(resolve(params.get("tab"))); }, [params]); // eslint-disable-line react-hooks/exhaustive-deps
  const go = (k: Key) => { setActive(k); router.replace(`/settings?tab=${k}`, { scroll: false }); };

  const [permView, setPermView] = useState<"matrix" | "roles">("matrix");
  const [notif, setNotif] = useState<Record<string, boolean>>({});
  const [days, setDays] = useState([true, true, true, true, true, true, false]);
  const save = () => notify("Settings saved");
  const saveBtn = <Button variant="contained" onClick={save}>Save changes</Button>;
  const field = (props: Parameters<typeof TextField>[0]) => <TextField size="small" fullWidth sx={FX} {...props} />;

  const content = (() => {
    switch (active) {
      case "general": return (
        <Panel title="General" description="How ServiceOps describes your business and formats information." action={saveBtn}>
          <Row label="Company name">{field({ defaultValue: "Northeast Facility Services" })}</Row>
          <Row label="Support email" hint="Shown on job cards and customer messages">{field({ defaultValue: "service@northeastfs.com" })}</Row>
          <Row label="Time zone"><Select size="small" fullWidth defaultValue="est" sx={FX}><MenuItem value="est">Eastern Time (UTC−05:00)</MenuItem><MenuItem value="cst">Central Time (UTC−06:00)</MenuItem></Select></Row>
          <Row label="Currency & tax" hint="Default tax applies to labour and parts"><div className="grid grid-cols-2 gap-3"><Select size="small" defaultValue="usd" sx={FX}><MenuItem value="usd">USD ($)</MenuItem><MenuItem value="cad">CAD ($)</MenuItem></Select>{field({ defaultValue: "18", label: "Tax %" })}</div></Row>
          <Row label="Date format"><Select size="small" fullWidth defaultValue="mdy" sx={FX}><MenuItem value="mdy">Sep 24, 2024</MenuItem><MenuItem value="dmy">24 Sep 2024</MenuItem><MenuItem value="iso">2024-09-24</MenuItem></Select></Row>
          <Row label="Distance units"><Select size="small" fullWidth defaultValue="mi" sx={FX}><MenuItem value="mi">Miles</MenuItem><MenuItem value="km">Kilometres</MenuItem></Select></Row>
        </Panel>
      );
      case "hours": return (
        <Panel title="Business hours" description="Used for SLA clocks and to show when technicians can be booked." action={saveBtn}>
          {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map((d, i) => (
            <Row key={d} label={d}>
              <div className="flex flex-wrap items-center gap-3">
                <Switch checked={days[i]} onChange={() => setDays(x => x.map((v, k) => (k === i ? !v : v)))} sx={switchSx} inputProps={{ "aria-label": `${d} open` }} />
                {days[i] ? (
                  <>
                    <TextField size="small" type="time" defaultValue={i === 5 ? "09:00" : "07:00"} sx={{ ...FX, width: 140 }} />
                    <span className="text-body text-[var(--text-muted)]">to</span>
                    <TextField size="small" type="time" defaultValue={i === 5 ? "13:00" : "19:00"} sx={{ ...FX, width: 140 }} />
                  </>
                ) : <span className="text-body text-[var(--text-muted)]">Closed — emergency callouts only</span>}
              </div>
            </Row>
          ))}
          <Row label="Holidays" hint="SLA clocks pause on these dates">
            <div className="flex flex-wrap gap-2">{["Nov 28 · Thanksgiving", "Dec 25 · Christmas", "Jan 1 · New Year"].map(h => <Pill key={h} tone="gray" dot={false}>{h}</Pill>)}<Button size="small" startIcon={<Plus size={12} />}>Add</Button></div>
          </Row>
        </Panel>
      );
      case "numbering": return (
        <Panel title="Numbering" description="Prefixes and next numbers for records. Changes apply to new records only." action={saveBtn}>
          <MiniTable head={["Record", "Prefix", "Next number", "Preview"]} minWidth={560}>
            {[["Work order", "WO-2024-", "00483"], ["Job", "JOB-", "10542"], ["Estimate", "EST-2024-", "0330"], ["Invoice", "INV-", "10542"], ["Asset", "AST-", "1051"], ["Part request", "PR-", "0500"]].map(([r, p, n]) => (
              <tr key={r}>
                <td className="px-4 text-table-cell text-[var(--text-primary)]">{r}</td>
                <td className="px-4"><TextField size="small" defaultValue={p} sx={{ ...FX, width: 140 }} /></td>
                <td className="px-4"><TextField size="small" defaultValue={n} sx={{ ...FX, width: 110 }} /></td>
                <td className="px-4 text-[var(--text-body)]">{p}{n}</td>
              </tr>
            ))}
          </MiniTable>
        </Panel>
      );
      case "types": return (
        <Panel title="Service types" description="Each type sets the default visit length, required skills and checklist for new jobs."
          action={<Button variant="outlined" startIcon={<Plus size={14} />} onClick={() => notify("New service type added as draft")}>Add service type</Button>}>
          <MiniTable head={["Service type", { label: "Default duration", right: true }, { label: "Response SLA", right: true }, "Qualified technicians", "Checklist", "Active"]} minWidth={820}>
            {SERVICE_TYPE_ORDER.map(s => {
              const Icon = SERVICE_ICON[s];
              const techs = TECH_PROFILES.filter(t => t.skills.includes(s)).length;
              return (
                <tr key={s}>
                  <td className="px-4"><span className="inline-flex items-center gap-2.5 text-table-cell text-[var(--text-primary)]"><Icon size={18} weight="fill" />{s}</span></td>
                  <td className="px-4 text-right text-table-cell text-[var(--text-body)]">{JOB_DURATION_HRS[s]} h</td>
                  <td className="px-4 text-right text-table-cell text-[var(--text-body)]">{SLA_HOURS_BY_SERVICE[s]} h</td>
                  <td className="px-4 text-table-cell text-[var(--text-body)]">{techs} of {TECH_PROFILES.length}</td>
                  <td className="px-4 text-table-cell text-[var(--text-body)]">6 steps <button type="button" className="ml-1 text-blue-600 hover:underline" onClick={() => notify(`${s} checklist opened`, undefined, "info")}>Edit</button></td>
                  <td className="px-4"><Switch defaultChecked size="small" sx={switchSx} inputProps={{ "aria-label": `${s} active` }} /></td>
                </tr>
              );
            })}
          </MiniTable>
        </Panel>
      );
      case "statuses": {
        const meaning: Record<JobStatus, [string, boolean]> = {
          "Yet to Start": ["Created, waiting to be booked", false], Scheduled: ["Booked with a technician", false], "En route": ["Technician travelling to site", true],
          "On site": ["Work under way", true], Pending: ["Waiting on customer or parts", true], Incomplete: ["Visit ended, work not finished", true],
          Completed: ["Work done and signed off", true], Cancelled: ["Will not go ahead", false],
        };
        return (
          <Panel title="Job statuses" description="The lifecycle every job moves through. Technicians can set the marked statuses from the mobile app." action={saveBtn}>
            <ul className="m-0 p-0 list-none flex flex-col gap-2">
              {STATUS_ORDER.map(s => {
                const m = STATUS_META[s];
                return (
                  <li key={s} className="flex items-center gap-3 rounded-xl border border-[var(--border-soft)] px-3 py-2.5">
                    <DotsSixVertical size={16} className="text-[var(--text-faint)] cursor-grab" />
                    <span className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-badge-text font-medium w-[120px] justify-center" style={{ backgroundColor: isDark ? m.bgDark : m.bgLight, color: isDark ? m.dark : m.light }}>{s}</span>
                    <span className="flex-1 text-body text-[var(--text-body)]">{meaning[s][0]}</span>
                    <label className="hidden sm:inline-flex items-center gap-1 text-caption text-[var(--text-muted)]"><Switch size="small" defaultChecked={meaning[s][1]} sx={switchSx} />Technician can set</label>
                  </li>
                );
              })}
            </ul>
          </Panel>
        );
      }
      case "priorities": return (
        <Panel title="Priorities" description="How urgent a request is. Priority tightens the response SLA and orders the Dispatch queue." action={saveBtn}>
          <MiniTable head={["Priority", "Meaning", "SLA multiplier", "Shown first in Dispatch"]} minWidth={640}>
            {(["High", "Medium", "Low"] as const).map((p, i) => (
              <tr key={p}>
                <td className="px-4"><span className="inline-flex items-center gap-1.5 text-table-cell font-medium" style={{ color: isDark ? PRIORITY_META[p].textDark : PRIORITY_META[p].text }}><Flag size={14} weight="fill" />{p}</span></td>
                <td className="px-4 text-table-cell text-[var(--text-body)]">{["Production or safety impact — same day", "Degraded service — within 1–2 days", "Routine or cosmetic — schedule normally"][i]}</td>
                <td className="px-4"><TextField size="small" defaultValue={["0.5×", "1×", "2×"][i]} sx={{ ...FX, width: 90 }} /></td>
                <td className="px-4"><Switch size="small" defaultChecked={i === 0} sx={switchSx} /></td>
              </tr>
            ))}
          </MiniTable>
        </Panel>
      );
      case "sla": return (
        <Panel title="SLA" description="Response and resolution targets by service type. Gold AMC customers are measured around the clock." action={saveBtn}>
          <MiniTable head={["Service type", "Respond within", "Resolve within", "Gold AMC", "Silver AMC", "Pay per visit"]} minWidth={760}>
            {SERVICE_TYPE_ORDER.map(s => (
              <tr key={s}>
                <td className="px-4 text-table-cell text-[var(--text-primary)]">{s}</td>
                <td className="px-4"><TextField size="small" defaultValue={`${SLA_HOURS_BY_SERVICE[s]} h`} sx={{ ...FX, width: 90 }} /></td>
                <td className="px-4"><TextField size="small" defaultValue={`${SLA_HOURS_BY_SERVICE[s] * 6} h`} sx={{ ...FX, width: 90 }} /></td>
                <td className="px-4 text-table-cell text-[var(--text-body)]">24/7</td>
                <td className="px-4 text-table-cell text-[var(--text-body)]">Business hours</td>
                <td className="px-4 text-table-cell text-[var(--text-muted)]">Best effort</td>
              </tr>
            ))}
          </MiniTable>
          <p className="m-0 mt-4 text-caption text-[var(--text-muted)]">Dispatch flags jobs at 75% of their response window; supervisors are notified on breach.</p>
        </Panel>
      );
      case "zones": return (
        <Panel title="Service zones" description="Dispatch regions. Technicians have a home zone; customers are placed in the zone that serves them."
          action={<Button variant="outlined" startIcon={<Plus size={14} />}>Add zone</Button>}>
          <MiniTable head={["Zone", "Covers", { label: "Technicians", right: true }, { label: "Customers", right: true }, ""]} minWidth={640}>
            {SERVICE_ZONES.map(z => (
              <tr key={z}>
                <td className="px-4 text-table-cell font-medium text-[var(--text-primary)]">{z}</td>
                <td className="px-4 text-table-cell text-[var(--text-body)]">{{ North: "Upper Manhattan, Bronx, Westchester", South: "Newark, Jersey City, Edison", East: "Brooklyn, Queens, Long Island", West: "Paramus, Hoboken, Bergen County", Central: "Midtown & Downtown Manhattan" }[z]}</td>
                <td className="px-4 text-right text-table-cell text-[var(--text-body)]">{TECH_PROFILES.filter(t => t.zone === z).length}</td>
                <td className="px-4 text-right text-table-cell text-[var(--text-body)]">{CUSTOMERS.filter(c => c.zone === z).length}</td>
                <td className="px-4 text-right"><Button size="small" startIcon={<PencilSimple size={12} />}>Edit</Button></td>
              </tr>
            ))}
          </MiniTable>
        </Panel>
      );
      case "teams": {
        const teams = Array.from(new Set(USERS.map(u => u.team)));
        return (
          <Panel title="Teams" description="Groups used for assignment, reporting and notifications." action={<Button variant="outlined" startIcon={<Plus size={14} />}>New team</Button>}>
            <MiniTable head={["Team", "Members", { label: "Size", right: true }]} minWidth={560}>
              {teams.map(t => {
                const members = USERS.filter(u => u.team === t);
                return (
                  <tr key={t}>
                    <td className="px-4 text-table-cell font-medium text-[var(--text-primary)] whitespace-nowrap">{t}</td>
                    <td className="px-4 text-table-cell text-[var(--text-body)]">{members.map(m => m.name).join(", ")}</td>
                    <td className="px-4 text-right text-table-cell text-[var(--text-body)]">{members.length}</td>
                  </tr>
                );
              })}
            </MiniTable>
          </Panel>
        );
      }
      case "notifications": {
        const events: [string, string, string][] = [
          ["Job assigned", "Technician", "app"], ["Technician on the way", "Customer", "sms"], ["Job completed — service report", "Customer", "email"],
          ["SLA at risk (75%)", "Dispatcher", "app"], ["SLA breached", "Service manager", "email"], ["Estimate approved", "Coordinator", "email"],
          ["Parts request back-ordered", "Dispatcher", "app"], ["Invoice overdue", "Service manager", "email"],
        ];
        const channels = ["Email", "SMS", "Push"];
        return (
          <Panel title="Notifications" description="Who is told about what, and how. Customer SMS uses your connected SMS provider." action={saveBtn}>
            <MiniTable head={["Event", "Recipient", ...channels.map(c => ({ label: c, right: true }))]} minWidth={640}>
              {events.map(([e, who, def]) => (
                <tr key={e}>
                  <td className="px-4 text-table-cell text-[var(--text-primary)]">{e}</td>
                  <td className="px-4 text-table-cell text-[var(--text-body)] whitespace-nowrap">{who}</td>
                  {channels.map(c => {
                    const k = `${e}|${c}`;
                    const on = notif[k] ?? (c.toLowerCase() === def || (def === "app" && c === "Push"));
                    return <td key={c} className="px-4 text-right"><Switch size="small" checked={on} onChange={() => setNotif(n => ({ ...n, [k]: !on }))} sx={switchSx} inputProps={{ "aria-label": `${e} by ${c}` }} /></td>;
                  })}
                </tr>
              ))}
            </MiniTable>
          </Panel>
        );
      }
      case "templates": return (
        <Panel title="Templates" description="Documents and messages ServiceOps generates. Merge fields fill in job, customer and asset details.">
          <MiniTable head={["Template", "Used for", "Last edited", ""]} minWidth={640}>
            {[["Job card", "Printed / PDF job sheet for technicians", "Aug 12, 2024"], ["Service report", "Emailed to the customer on completion", "Sep 02, 2024"], ["Estimate", "Quote sent for approval", "Jul 30, 2024"], ["Invoice", "Billing document (synced to EVOQ Billing)", "Jun 18, 2024"], ["“On the way” SMS", "Customer text when technician departs", "Sep 10, 2024"], ["Appointment reminder", "Customer email 24h before visit", "May 06, 2024"]].map(([n, u, d]) => (
              <tr key={n}>
                <td className="px-4 text-table-cell font-medium text-[var(--text-primary)] whitespace-nowrap">{n}</td>
                <td className="px-4 text-table-cell text-[var(--text-body)]">{u}</td>
                <td className="px-4 text-table-cell text-[var(--text-muted)] whitespace-nowrap">{d}</td>
                <td className="px-4 text-right"><Button size="small" startIcon={<PencilSimple size={12} />} onClick={() => notify(`${n} template opened`, undefined, "info")}>Edit</Button></td>
              </tr>
            ))}
          </MiniTable>
        </Panel>
      );
      case "permission": return (
        <div className="flex flex-col gap-3">
          <Segmented value={permView} onChange={setPermView} options={[{ value: "matrix", label: "Permissions by module" }, { value: "roles", label: "Role hierarchy" }]} />
          <div className="rounded-2xl border border-[var(--border-soft)] overflow-hidden flex flex-col min-h-[640px]" style={{ boxShadow: CARD_SHADOW }}>
            {permView === "matrix" ? <PermissionPanel /> : <RolesPanel />}
          </div>
        </div>
      );
      case "homepage": return (
        <div className="rounded-2xl border border-[var(--border-soft)] overflow-hidden flex flex-col min-h-[560px]" style={{ boxShadow: CARD_SHADOW }}>
          <CustomizeHomepagePanel />
        </div>
      );
    }
  })();

  const current = ALL.find(i => i.key === active)!;

  return (
    <PageShell>
      <PageHeader title="Settings" subtitle="Configure how ServiceOps works for your team." crumbs={[{ label: "Admin" }, { label: "Settings" }]} />

      <div className="grid grid-cols-1 md:grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)] gap-4 items-start">
        <nav aria-label="Settings sections" className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-2 lg:sticky lg:top-[88px]" style={{ boxShadow: CARD_SHADOW }}>
          <div className="lg:hidden p-1">
            <select value={active} onChange={e => go(e.target.value as Key)} aria-label="Settings section"
              className="w-full h-11 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-3 text-body text-[var(--text-primary)]">
              {NAV.map(g => <optgroup key={g.group} label={g.group}>{g.items.map(i => <option key={i.key} value={i.key}>{i.label}</option>)}</optgroup>)}
            </select>
            <p className="m-0 mt-2 px-1 text-caption text-[var(--text-muted)]">{current.hint}</p>
          </div>
          <div className="hidden lg:block">
            {NAV.map(g => (
              <div key={g.group} className="mb-1">
                <p className="m-0 px-3 pt-3 pb-1.5 text-nav-group-label uppercase text-[var(--text-muted)]">{g.group}</p>
                {g.items.map(i => {
                  const Icon = i.icon;
                  const on = i.key === active;
                  return (
                    <button key={i.key} type="button" onClick={() => go(i.key)} aria-current={on ? "page" : undefined}
                      className={`w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-colors ${on ? "bg-[var(--serviceops-primary-10)] text-[var(--text-primary)] font-semibold" : "text-[var(--text-body)] hover:bg-[var(--serviceops-tint)]"}`}>
                      <Icon size={17} weight="duotone" className={on ? "text-[var(--serviceops-primary)]" : "text-[var(--text-muted)]"} />
                      <span className="text-body">{i.label}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </nav>
        <div className="min-w-0">{content}</div>
      </div>
      {toastNode}
    </PageShell>
  );
}

