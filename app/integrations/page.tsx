"use client";
import { useMemo, useState } from "react";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Switch from "@mui/material/Switch";
import {
  AddressBook, Package, Receipt, Factory, Calculator, MapTrifold, EnvelopeSimple, ChatText, CreditCard, Code, WebhooksLogo,
  CheckCircle, WarningCircle, XCircle, PlugsConnected, ArrowsClockwise, Info,
} from "@phosphor-icons/react";
import { PageShell, PageHeader, Pill, SideDrawer, DrawerSection, KV, useToast, Segmented, type PillTone } from "@/components/ui/ServiceOpsUI";
import { CARD_SHADOW, IconTile, type Tone } from "@/components/dashboard/DashboardSection";
import { useJobFieldSx } from "@/components/jobs/jobFormStyles";

type State = "Connected" | "Not connected" | "Configuration required" | "Error";
const STATE_TONE: Record<State, PillTone> = { Connected: "green", "Not connected": "gray", "Configuration required": "amber", Error: "red" };
const STATE_ICON: Record<State, typeof CheckCircle> = { Connected: CheckCircle, "Not connected": PlugsConnected, "Configuration required": WarningCircle, Error: XCircle };

interface Integration {
  key: string; name: string; provider: string; group: string; icon: typeof Code; tone: Tone;
  state: State; summary: string; syncs: string[]; lastSync?: string; issue?: string; fields: { label: string; value: string; secret?: boolean }[];
}

const SEED: Integration[] = [
  { key: "crm", name: "EVOQ CRM", provider: "EVOQ", group: "EVOQ suite", icon: AddressBook, tone: "amber", state: "Connected",
    summary: "Customers, contacts and sites stay in step with sales.", syncs: ["Customers ⇄", "Contacts ⇄", "Sites →"], lastSync: "Sep 24, 2024 10:05 AM",
    fields: [{ label: "Workspace", value: "northeastfs.evoq.app" }, { label: "Sync direction", value: "Two-way" }] },
  { key: "inventory", name: "EVOQ Inventory", provider: "EVOQ", group: "EVOQ suite", icon: Package, tone: "amber", state: "Connected",
    summary: "Parts catalogue, warehouse stock and purchasing. ServiceOps shows the field view.", syncs: ["Parts →", "Stock levels → every 15 min", "Part requests ⇄", "Returns →"], lastSync: "Sep 24, 2024 10:15 AM",
    fields: [{ label: "Warehouse", value: "Newark Main (WH-01)" }, { label: "Van locations", value: "8 mapped" }] },
  { key: "billing", name: "EVOQ Billing", provider: "EVOQ", group: "EVOQ suite", icon: Receipt, tone: "amber", state: "Configuration required",
    summary: "Invoices, payments and credit notes for completed jobs.", syncs: ["Invoices →", "Payment status ←"], issue: "Map ServiceOps tax rate (18%) to a Billing tax code before invoices can sync.",
    fields: [{ label: "Workspace", value: "northeastfs.evoq.app" }, { label: "Tax code", value: "" }] },
  { key: "erp", name: "ERP", provider: "SAP Business One", group: "Business systems", icon: Factory, tone: "blue", state: "Not connected",
    summary: "Cost centres, purchase orders and fixed-asset records.", syncs: ["Cost centres ←", "Purchase orders ←", "Asset register ⇄"], fields: [{ label: "Service layer URL", value: "" }, { label: "Company DB", value: "" }] },
  { key: "accounting", name: "Accounting", provider: "QuickBooks Online", group: "Business systems", icon: Calculator, tone: "blue", state: "Error",
    summary: "General ledger postings for service revenue and parts cost.", syncs: ["Journal entries →"], lastSync: "Sep 21, 2024 06:00 PM", issue: "Authorisation expired on Sep 22. Reconnect to resume postings — 7 entries are queued.",
    fields: [{ label: "Company", value: "Northeast Facility Services LLC" }] },
  { key: "maps", name: "Maps & location", provider: "Google Maps Platform", group: "Location", icon: MapTrifold, tone: "green", state: "Not connected",
    summary: "Live technician locations, travel times and routing in Dispatch. Until connected, Dispatch shows a schematic zone map.", syncs: ["Geocoding", "Drive times", "Live locations"],
    fields: [{ label: "API key", value: "", secret: true }] },
  { key: "email", name: "Email", provider: "Microsoft 365", group: "Communication", icon: EnvelopeSimple, tone: "purple", state: "Connected",
    summary: "Service reports, estimates and reminders sent from service@northeastfs.com.", syncs: ["Outbound email"], lastSync: "Sep 24, 2024 09:58 AM",
    fields: [{ label: "Sender", value: "service@northeastfs.com" }, { label: "Reply-to", value: "dispatch@northeastfs.com" }] },
  { key: "sms", name: "SMS", provider: "Twilio", group: "Communication", icon: ChatText, tone: "purple", state: "Configuration required",
    summary: "“Technician on the way” and appointment texts to customers.", syncs: ["Outbound SMS", "Delivery receipts"], issue: "Sender number +1 646 555 0190 is awaiting carrier registration (A2P 10DLC).",
    fields: [{ label: "Account SID", value: "AC••••••••3f2a", secret: true }, { label: "Sender number", value: "+1 646 555 0190" }] },
  { key: "payments", name: "Payments", provider: "Stripe", group: "Payments", icon: CreditCard, tone: "green", state: "Not connected",
    summary: "Card and ACH payment links on invoices and on-site collection by technicians.", syncs: ["Payment links", "Payouts ←"], fields: [{ label: "Account", value: "" }] },
  { key: "api", name: "REST API", provider: "ServiceOps", group: "Developer", icon: Code, tone: "gray", state: "Connected",
    summary: "Programmatic access for your own tools. 2 active keys.", syncs: ["Read & write — scoped keys"], lastSync: "Key last used Sep 24, 2024 08:41 AM",
    fields: [{ label: "Key · Reporting warehouse", value: "so_live_••••••••a91c", secret: true }, { label: "Key · Facilities portal", value: "so_live_••••••••77de", secret: true }] },
  { key: "webhooks", name: "Webhooks", provider: "ServiceOps", group: "Developer", icon: WebhooksLogo, tone: "gray", state: "Connected",
    summary: "Push job, work order and invoice events to other systems. 3 endpoints.", syncs: ["job.completed", "workorder.created", "invoice.paid"], lastSync: "Delivered Sep 24, 2024 10:12 AM · 99.6% success",
    fields: [{ label: "Endpoint", value: "https://hooks.northeastfs.com/serviceops" }, { label: "Signing secret", value: "whsec_••••••••", secret: true }] },
];

export default function IntegrationsPage() {
  const FX = useJobFieldSx();
  const { toastNode, notify } = useToast();
  const [items, setItems] = useState(SEED);
  const [open, setOpen] = useState<Integration | null>(null);
  const [filter, setFilter] = useState<"all" | "attention" | "connected" | "available">("all");

  const counts = useMemo(() => ({
    connected: items.filter(i => i.state === "Connected").length,
    attention: items.filter(i => i.state === "Error" || i.state === "Configuration required").length,
    available: items.filter(i => i.state === "Not connected").length,
  }), [items]);
  const shown = items.filter(i =>
    filter === "all" || (filter === "connected" && i.state === "Connected") || (filter === "available" && i.state === "Not connected")
    || (filter === "attention" && (i.state === "Error" || i.state === "Configuration required")));
  const groups = Array.from(new Set(shown.map(i => i.group)));

  const setState = (key: string, state: State, msg: string) => {
    setItems(list => list.map(i => (i.key === key ? { ...i, state, issue: state === "Connected" ? undefined : i.issue, lastSync: state === "Connected" ? "Just now" : i.lastSync } : i)));
    setOpen(o => (o && o.key === key ? { ...o, state, issue: state === "Connected" ? undefined : o.issue, lastSync: state === "Connected" ? "Just now" : o.lastSync } : o));
    notify(msg);
  };

  return (
    <PageShell>
      <PageHeader title="Integrations" subtitle="Connected systems that share data with ServiceOps."
        crumbs={[{ label: "Admin" }, { label: "Integrations" }]} />

      <Segmented value={filter} onChange={setFilter} options={[
        { value: "all", label: "All", count: items.length },
        { value: "attention", label: "Needs attention", count: counts.attention },
        { value: "connected", label: "Connected", count: counts.connected },
        { value: "available", label: "Not connected", count: counts.available },
      ]} />

      {groups.map(g => (
        <section key={g} className="flex flex-col gap-3">
          <h2 className="m-0 text-nav-group-label uppercase text-[var(--text-muted)]">{g}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
            {shown.filter(i => i.group === g).map(i => {
              const Icon = i.icon;
              const SIcon = STATE_ICON[i.state];
              return (
                <button key={i.key} type="button" onClick={() => setOpen(i)}
                  className="text-left rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-4 sm:p-5 flex flex-col gap-3 hover:border-[var(--serviceops-primary)] transition-colors"
                  style={{ boxShadow: CARD_SHADOW }}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <IconTile tone={i.tone} size={44}><Icon size={22} weight="duotone" /></IconTile>
                      <div className="min-w-0">
                        <p className="m-0 text-label font-bold text-[var(--text-primary)] truncate">{i.name}</p>
                        <p className="m-0 text-caption text-[var(--text-muted)] truncate">{i.provider}</p>
                      </div>
                    </div>
                    <Pill tone={STATE_TONE[i.state]}>{i.state === "Configuration required" ? "Setup needed" : i.state}</Pill>
                  </div>
                  <p className="m-0 text-body text-[var(--text-body)] flex-1">{i.summary}</p>
                  {i.issue ? (
                    <p className="m-0 flex items-start gap-1.5 text-caption" style={{ color: i.state === "Error" ? "#DC2626" : "#B45309" }}>
                      <SIcon size={14} weight="fill" className="mt-px flex-shrink-0" />{i.issue}
                    </p>
                  ) : (
                    <p className="m-0 text-caption text-[var(--text-muted)]">{i.lastSync ? `Last sync · ${i.lastSync}` : "Not connected"}</p>
                  )}
                </button>
              );
            })}
          </div>
        </section>
      ))}

      <p className="m-0 flex items-center gap-2 text-caption text-[var(--text-muted)]"><Info size={14} />Integrations move data between systems. Inventory and Billing screens in ServiceOps work on the synced data.</p>

      <SideDrawer open={!!open} onClose={() => setOpen(null)} icon={open?.icon ?? Code} title={open?.name ?? ""} subtitle={open ? `${open.provider} · ${open.state}` : ""}
        footer={open ? (
          open.state === "Not connected" ? (
            <><Button onClick={() => setOpen(null)} sx={{ color: "var(--text-muted)" }}>Cancel</Button><Button variant="contained" startIcon={<PlugsConnected size={14} />} onClick={() => setState(open.key, "Connected", `${open.name} connected`)}>Connect</Button></>
          ) : (
            <>
              <Button color="error" onClick={() => setState(open.key, "Not connected", `${open.name} disconnected`)}>Disconnect</Button>
              {open.state === "Connected"
                ? <Button variant="contained" startIcon={<ArrowsClockwise size={14} />} onClick={() => setState(open.key, "Connected", `${open.name} synced`)}>Sync now</Button>
                : <Button variant="contained" onClick={() => setState(open.key, "Connected", `${open.name} ${open.state === "Error" ? "reconnected" : "configured"}`)}>{open.state === "Error" ? "Reconnect" : "Save & connect"}</Button>}
            </>
          )
        ) : undefined}>
        {open && (
          <>
            {open.issue && (
              <div className="flex items-start gap-2 rounded-xl px-3 py-2.5" style={{ backgroundColor: open.state === "Error" ? "rgba(239,68,68,0.08)" : "rgba(245,158,11,0.10)" }}>
                <WarningCircle size={16} weight="fill" color={open.state === "Error" ? "#EF4444" : "#F59E0B"} className="mt-0.5 flex-shrink-0" />
                <span className="text-body text-[var(--text-primary)]">{open.issue}</span>
              </div>
            )}
            <p className="m-0 text-body text-[var(--text-body)]">{open.summary}</p>
            <DrawerSection title="What syncs">
              <div className="flex flex-wrap gap-2">{open.syncs.map(s => <Pill key={s} tone="blue" dot={false}>{s}</Pill>)}</div>
              <p className="m-0 mt-2 text-caption text-[var(--text-muted)]">→ to ServiceOps · ← from ServiceOps · ⇄ both ways</p>
            </DrawerSection>
            <DrawerSection title="Connection">
              <div className="flex flex-col gap-3">
                {open.fields.map(f => <TextField key={f.label} label={f.label} defaultValue={f.value} type={f.secret ? "password" : "text"} size="small" fullWidth sx={FX} placeholder={f.value ? undefined : "Required"} />)}
              </div>
            </DrawerSection>
            {open.state === "Connected" && (
              <DrawerSection title="Status">
                <KV label="Health"><Pill tone="green">Healthy</Pill></KV>
                <KV label="Last sync">{open.lastSync ?? "—"}</KV>
                <KV label="Auto-sync"><Switch size="small" defaultChecked sx={{ "& .MuiSwitch-switchBase.Mui-checked": { color: "#F59E0B" }, "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": { backgroundColor: "#F59E0B" } }} /></KV>
              </DrawerSection>
            )}
          </>
        )}
      </SideDrawer>
      {toastNode}
    </PageShell>
  );
}
