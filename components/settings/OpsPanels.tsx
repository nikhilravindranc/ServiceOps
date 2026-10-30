"use client";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import Switch from "@mui/material/Switch";
import { Trash, Play } from "@phosphor-icons/react";
import { MiniTable, Pill, type PillTone } from "@/components/ui/ServiceOpsUI";
import { TECH_PROFILES } from "@/lib/serviceData";
import { SERVICE_TYPE_ORDER } from "@/lib/jobsData";
import { runAutomations, type AutomationRow } from "@/lib/automations";

type Notify = (msg: string, href?: string, severity?: "success" | "info") => void;
const inputCls = "h-9 px-3 rounded-[10px] text-[13px] border-[1.5px] border-[var(--serviceops-soft)] bg-[var(--bg-card)] text-[var(--text-primary)] outline-none focus:border-[var(--serviceops-primary)]";
const primary = "inline-flex items-center gap-1.5 h-9 px-3.5 rounded-[10px] text-[13px] font-bold text-[#3B1F00] bg-[var(--serviceops-primary)] hover:bg-[var(--serviceops-hover)] disabled:opacity-50";
const switchSx = { "& .MuiSwitch-switchBase.Mui-checked": { color: "#F59E0B" }, "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": { backgroundColor: "#F59E0B" } };
const fmt = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

type Cert = { id: string; technician: string; name: string; serviceType: string; expiresOn: string };

export function CertPanel({ notify }: { notify: Notify }) {
  const [rows, setRows] = useState<Cert[] | null>(null);
  const [f, setF] = useState({ technician: TECH_PROFILES[0]?.name ?? "", name: "", serviceType: SERVICE_TYPE_ORDER[0], expiresOn: "" });
  const load = useCallback(async () => { const r = await fetch("/api/certifications"); setRows(r.ok ? await r.json() : []); }, []);
  useEffect(() => { load(); }, [load]);

  const add = async () => {
    if (f.name.trim().length < 2 || !f.expiresOn) { notify("Enter the certification name and its expiry date", undefined, "info"); return; }
    const res = await fetch("/api/certifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
    if (!res.ok) { notify(res.status === 403 ? "Only administrators and service managers can change certifications" : "Could not save", undefined, "info"); return; }
    setF({ ...f, name: "", expiresOn: "" }); load(); notify("Certification added");
  };
  const remove = async (id: string) => { await fetch(`/api/certifications/${id}`, { method: "DELETE" }); load(); };
  const tone = (iso: string): PillTone => { const d = (Date.parse(iso) - Date.now()) / 86_400_000; return d < 0 ? "red" : d < 60 ? "amber" : "green"; };

  return (
    <div>
      <p className="m-0 mb-3 text-body text-[var(--text-body)]">Once a certification is recorded for a service type, only technicians holding a certification for that type that is still valid on the visit date can be scheduled for it in Dispatch.</p>
      <div className="flex flex-wrap gap-2 mb-4">
        <select aria-label="Technician" className={inputCls} value={f.technician} onChange={e => setF({ ...f, technician: e.target.value })}>{TECH_PROFILES.map(t => <option key={t.name}>{t.name}</option>)}</select>
        <input aria-label="Certification name" className={`${inputCls} w-[200px]`} placeholder="e.g. Electrical licence" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} />
        <select aria-label="Service type" className={inputCls} value={f.serviceType} onChange={e => setF({ ...f, serviceType: e.target.value as typeof f.serviceType })}>{SERVICE_TYPE_ORDER.map(t => <option key={t}>{t}</option>)}</select>
        <input aria-label="Expires on" type="date" className={inputCls} value={f.expiresOn} onChange={e => setF({ ...f, expiresOn: e.target.value })} />
        <button type="button" className={primary} onClick={add}>Add</button>
      </div>
      {rows?.length ? (
        <MiniTable head={["Technician", "Certification", "Service type", "Expires", ""]} minWidth={560}>
          {rows.map(c => (
            <tr key={c.id} className="border-b border-[var(--border-soft)] last:border-b-0">
              <td className="px-3 py-2.5 text-table-cell">{c.technician}</td><td className="px-3 py-2.5 text-table-cell">{c.name}</td><td className="px-3 py-2.5 text-table-cell">{c.serviceType}</td>
              <td className="px-3 py-2.5"><Pill tone={tone(c.expiresOn)}>{fmt(c.expiresOn)}</Pill></td>
              <td className="px-3 py-2.5 text-right"><button type="button" aria-label={`Remove ${c.name} for ${c.technician}`} onClick={() => remove(c.id)} className="p-1 text-[var(--text-muted)] hover:text-red-500"><Trash size={15} /></button></td>
            </tr>
          ))}
        </MiniTable>
      ) : <p className="m-0 text-body text-[var(--text-muted)]">{rows === null ? "Loading…" : "No certifications recorded. Until you add some, any technician can be assigned to any service type."}</p>}
    </div>
  );
}

type Log = { id: string; channel: string; event: string; recipient: string; subject: string | null; body: string; status: string; at: string };
const STATUS_TONE: Record<string, PillTone> = { sent: "green", test: "blue", logged: "amber", failed: "red" };

const linkify = (text: string): ReactNode[] =>
  text.split(/(https?:\/\/\S+)/g).map((part, i) => /^https?:\/\//.test(part) ? <a key={i} href={part} className="text-blue-600 underline break-all" target="_blank" rel="noreferrer">{part}</a> : part);

export function DeliveryLogPanel({ notify }: { notify: Notify }) {
  const [rows, setRows] = useState<Log[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [f, setF] = useState({ channel: "email", to: "", message: "This is a test message from ServiceOps." });
  const load = useCallback(() => { fetch("/api/notifications").then(r => (r.ok ? r.json() : [])).then(setRows).catch(() => setRows([])); }, []);
  useEffect(() => { load(); }, [load]);

  const sendTest = async () => {
    const res = await fetch("/api/notify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ channel: f.channel, event: "test.message", to: f.to, subject: "Test message", message: f.message }) });
    if (!res.ok) { notify("Could not send the test message", undefined, "info"); return; }
    notify("Test message recorded below. Open it to read it."); load();
  };

  return (
    <div>
      <p className="m-0 mb-3 text-body text-[var(--text-body)]">Every customer message is recorded here. <b>Test</b> means the built-in test provider accepted it: nothing left the server, and you can read it by opening the row. <b>Sent</b> means a real email provider delivered it. SMS and WhatsApp always use the test provider until a provider is connected.</p>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <select aria-label="Channel" className={inputCls} value={f.channel} onChange={e => setF({ ...f, channel: e.target.value })}><option value="email">Email</option><option value="sms">SMS</option><option value="whatsapp">WhatsApp</option></select>
        <input aria-label="Recipient" className={`${inputCls} w-[220px]`} placeholder={f.channel === "email" ? "name@example.com" : "+1 555 0100"} value={f.to} onChange={e => setF({ ...f, to: e.target.value })} />
        <input aria-label="Message" className={`${inputCls} flex-1 min-w-[220px]`} value={f.message} onChange={e => setF({ ...f, message: e.target.value })} />
        <button type="button" className={primary} onClick={sendTest}>Send test message</button>
      </div>
      {rows?.length ? (
        <MiniTable head={["When", "Event", "To", "Subject", "Channel", "Status"]} minWidth={720}>
          {rows.flatMap(l => {
            const open = openId === l.id;
            const row = (
              <tr key={l.id} className="border-b border-[var(--border-soft)] cursor-pointer hover:bg-[var(--serviceops-tint)]" onClick={() => setOpenId(open ? null : l.id)} aria-expanded={open}>
                <td className="px-3 py-2.5 text-table-cell whitespace-nowrap">{new Date(l.at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</td>
                <td className="px-3 py-2.5 text-table-cell">{l.event}</td><td className="px-3 py-2.5 text-table-cell">{l.recipient}</td>
                <td className="px-3 py-2.5 text-table-cell max-w-[260px] truncate">{l.subject}</td><td className="px-3 py-2.5 text-table-cell capitalize">{l.channel}</td>
                <td className="px-3 py-2.5"><Pill tone={STATUS_TONE[l.status] ?? "gray"}>{l.status}</Pill></td>
              </tr>
            );
            return open ? [row, <tr key={l.id + "-body"} className="border-b border-[var(--border-soft)] bg-[var(--serviceops-tint)]"><td colSpan={6} className="px-4 py-3 text-[13px] whitespace-pre-wrap">{linkify(l.body)}</td></tr>] : [row];
          })}
        </MiniTable>
      ) : <p className="m-0 text-body text-[var(--text-muted)]">{rows === null ? "Loading…" : "No messages yet. Booking confirmations, estimate links and reminders will appear here."}</p>}
    </div>
  );
}

const LABEL: Record<AutomationRow["key"], { title: string; hint: string }> = {
  "quote.followup": { title: "Follow up on estimates", hint: "Email the customer a fresh approval link when a sent estimate has had no answer for" },
  "invoice.reminder": { title: "Remind about overdue invoices", hint: "Email a payment link for an overdue invoice, repeating no more often than every" },
  "request.autoarchive": { title: "Decline untouched requests", hint: "Mark requests still New as Declined after" },
};

export function AutomationsPanel({ notify }: { notify: Notify }) {
  const [rules, setRules] = useState<AutomationRow[] | null>(null);
  const [running, setRunning] = useState(false);
  const load = useCallback(async () => { const r = await fetch("/api/automations"); setRules(r.ok ? await r.json() : []); }, []);
  useEffect(() => { load(); }, [load]);

  const save = async (rule: AutomationRow, patch: Partial<AutomationRow>) => {
    const next = { ...rule, ...patch };
    const res = await fetch("/api/automations", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: next.key, enabled: next.enabled, afterDays: next.afterDays }) });
    if (!res.ok) { notify(res.status === 403 ? "Only administrators and service managers can change automations" : "Could not save", undefined, "info"); return; }
    load();
  };
  const run = async () => {
    setRunning(true);
    const r = await runAutomations();
    setRunning(false); load();
    notify(`Ran automations: ${r.estimates} estimate follow-up${r.estimates === 1 ? "" : "s"}, ${r.invoices} invoice reminder${r.invoices === 1 ? "" : "s"}, ${r.archived} request${r.archived === 1 ? "" : "s"} declined`);
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <p className="m-0 text-body text-[var(--text-body)]">Rules run when the workspace opens and whenever you press Run now.</p>
        <button type="button" className={primary} onClick={run} disabled={running}><Play size={14} weight="fill" />{running ? "Running…" : "Run now"}</button>
      </div>
      {(rules ?? []).map(r => (
        <div key={r.key} className="flex flex-wrap items-center gap-3 py-3.5 border-b border-[var(--border-soft)] last:border-b-0">
          <Switch checked={r.enabled} onChange={(_, v) => save(r, { enabled: v })} sx={switchSx} inputProps={{ "aria-label": LABEL[r.key].title }} />
          <div className="flex-1 min-w-[240px]">
            <p className="m-0 text-label text-[var(--text-primary)]">{LABEL[r.key].title}</p>
            <p className="m-0 text-caption text-[var(--text-muted)]">{LABEL[r.key].hint}
              {" "}<select aria-label="Days" className={`${inputCls} !h-7 !px-2 inline-block`} value={r.afterDays} onChange={e => save(r, { afterDays: Number(e.target.value) })}>
                {[1, 2, 3, 5, 7, 14, 30].map(d => <option key={d} value={d}>{d}</option>)}</select> day{r.afterDays === 1 ? "" : "s"}.
              {r.lastRunAt && <> Last run {fmt(r.lastRunAt)}.</>}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
