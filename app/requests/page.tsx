"use client";
import { useOpenOnNew } from "@/lib/useOpenOnNew";
import { useCallback, useEffect, useMemo, useState } from "react";
import TextField from "@mui/material/TextField";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import { Plus, Tray, Sparkle, MagnifyingGlass, CheckCircle, XCircle, ClipboardText, FileText, ArrowsClockwise } from "@phosphor-icons/react";
import {
  PageShell, PageHeader, PrimaryButton, KpiTile, KpiRow, FilterBar, ListCard, SearchBox, FilterSelect, DataTable,
  PriorityTag, ServiceTypeCell, Stack, ActionMenu, useToast, Pill, SideDrawer, DrawerSection, DrawerActions, Segmented, type Column, type PillTone,
} from "@/components/ui/ServiceOpsUI";
import { useJobFieldSx } from "@/components/jobs/jobFormStyles";
import { SERVICE_TYPE_ORDER, type JobPriority, type ServiceType } from "@/lib/jobsData";
import { addWorkOrder, customerByName, fmtDay, type WOSource } from "@/lib/serviceData";
import { matchesQuery } from "@/lib/filtering";

type Req = {
  id: string; number: string; customerName: string; contactName: string | null; email: string | null; phone: string | null;
  source: string; serviceType: string; priority: JobPriority; title: string; description: string | null; site: string | null;
  campaign: string | null; status: "New" | "Reviewing" | "Converted" | "Declined"; convertedTo: string | null; createdAt: string;
};

const STATUSES = ["New", "Reviewing", "Converted", "Declined"] as const;
const STATUS_TONE: Record<Req["status"], PillTone> = { New: "purple", Reviewing: "amber", Converted: "green", Declined: "gray" };
const SOURCES = ["Phone", "Email", "Web form", "Online booking", "Customer portal", "Technician"];
// Work orders only know five intake channels; online and web requests count as portal.
const WO_SOURCE: Record<string, WOSource> = { Phone: "Phone", Email: "Email", "Web form": "Customer portal", "Online booking": "Customer portal", "Customer portal": "Customer portal", Technician: "Technician" };
const ALL_SOURCES = "All sources";
/** Relative age from the real clock (the sample dataset runs on its own fixed clock). */
const ago = (iso: string) => {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  if (m < 1440) return `${Math.round(m / 60)}h ago`;
  return `${Math.round(m / 1440)}d ago`;
};
const EMPTY = { customerName: "", contactName: "", email: "", phone: "", source: "Phone", serviceType: "HVAC", priority: "Medium" as JobPriority, title: "", description: "", site: "", campaign: "" };

export default function RequestsPage() {
  const FX = useJobFieldSx();
  const { toastNode, notify } = useToast();
  const [rows, setRows] = useState<Req[] | null>(null);
  const [statusF, setStatusF] = useState<Req["status"] | "All">("All");
  const [view, setView] = useState<"all" | "bookings">("all");
  const [sourceF, setSourceF] = useState(ALL_SOURCES);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  useOpenOnNew(() => setOpen(true));

  const load = useCallback(async () => {
    const res = await fetch("/api/requests");
    setRows(res.ok ? await res.json() : []);
  }, []);
  useEffect(() => { load(); }, [load]);

  const counts = useMemo(() => Object.fromEntries(STATUSES.map(s => [s, (rows ?? []).filter(r => r.status === s).length])) as Record<Req["status"], number>, [rows]);
  const toVerify = useMemo(() => (rows ?? []).filter(r => r.source === "Online booking" && r.status === "New"), [rows]);
  const filtered = useMemo(() => (rows ?? []).filter(r =>
    (view === "all" || (r.source === "Online booking" && r.status === "New")) &&
    (statusF === "All" || r.status === statusF) &&
    (sourceF === ALL_SOURCES || r.source === sourceF) &&
    matchesQuery(search, r.number, r.customerName, r.title, r.contactName, r.site)), [rows, statusF, sourceF, search, view]);

  const patch = async (id: string, body: object) => {
    const res = await fetch(`/api/requests/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) { notify("Could not update the request", undefined, "info"); return false; }
    await load();
    return true;
  };

  const convert = async (r: Req, needsEstimate: boolean) => {
    const cust = customerByName(r.customerName);
    const wo = addWorkOrder({
      title: r.title, customer: r.customerName, contactId: undefined, serviceType: r.serviceType as ServiceType, priority: r.priority,
      description: [r.description, r.campaign ? `Campaign: ${r.campaign}` : "", `From request ${r.number}`].filter(Boolean).join("\n"),
      assetId: null, preferredDate: null, source: WO_SOURCE[r.source] ?? "Phone", needsEstimate,
    });
    if (!cust && r.site) wo.site = r.site;
    if (await patch(r.id, { status: "Converted", convertedTo: `work-order:${wo.id}` })) {
      notify(`${r.number} converted to ${wo.number}${needsEstimate ? " (estimate required)" : ""}`, `/work-orders/${wo.id}`);
    }
  };

  const submit = async () => {
    const e: Record<string, string> = {};
    if (form.customerName.trim().length < 2) e.customerName = "Customer is required";
    if (form.title.trim().length < 3) e.title = "Describe the request in a few words";
    setErrors(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    const res = await fetch("/api/requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    setSaving(false);
    if (!res.ok) { notify("Could not save the request", undefined, "info"); return; }
    const created: Req = await res.json();
    setOpen(false); setForm(EMPTY); await load();
    notify(`${created.number} logged for ${created.customerName}`);
  };

  const set = (k: keyof typeof EMPTY, v: string) => { setForm(f => ({ ...f, [k]: v })); setErrors(x => { const n = { ...x }; delete n[k]; return n; }); };

  const columns: Column<Req>[] = [
    { key: "number", header: "Request #", cell: r => <span className="text-table-cell font-semibold text-blue-600">{r.number}</span>, sortValue: r => r.number },
    { key: "title", header: "Request", cell: r => (
      <div className="max-w-[260px]"><p className="m-0 text-table-cell text-[var(--text-primary)] truncate">{r.title}</p>
        <p className="m-0 text-table-cell-secondary text-[var(--text-muted)] truncate">{r.site || "No site given"}</p></div>) },
    { key: "customer", header: "Customer", cell: r => <Stack top={r.customerName} bottom={r.contactName ?? undefined} />, sortValue: r => r.customerName },
    { key: "source", header: "Source", cell: r => <Stack top={r.source} bottom={r.campaign ?? undefined} />, sortValue: r => r.source },
    { key: "type", header: "Service type", cell: r => <ServiceTypeCell type={r.serviceType as ServiceType} />, hideBelow: "wide" },
    { key: "priority", header: "Priority", cell: r => <PriorityTag priority={r.priority} />, sortValue: r => ["High", "Medium", "Low"].indexOf(r.priority) },
    { key: "status", header: "Status", cell: r => <Pill tone={STATUS_TONE[r.status]}>{r.status}</Pill>, sortValue: r => STATUSES.indexOf(r.status) },
    { key: "received", header: "Received", cell: r => <Stack top={fmtDay(new Date(r.createdAt).getTime())} bottom={ago(r.createdAt)} />, sortValue: r => r.createdAt },
    { key: "actions", header: "Actions", align: "right", cell: r => (
      <span onClick={e => e.stopPropagation()}>
        <ActionMenu label={`Actions for ${r.number}`} actions={r.status === "Converted" || r.status === "Declined" ? [
          { label: "Reopen request", icon: ArrowsClockwise, onClick: () => patch(r.id, { status: "New" }) },
        ] : [
          ...(r.source === "Online booking" && r.status === "New" ? [{ label: "Verify booking", icon: CheckCircle, onClick: () => patch(r.id, { status: "Reviewing" }) }] : []),
          { label: "Convert to work order", icon: ClipboardText, onClick: () => convert(r, false) },
          { label: "Convert and request estimate", icon: FileText, onClick: () => convert(r, true) },
          ...(r.status === "New" ? [{ label: "Mark as reviewing", icon: MagnifyingGlass, onClick: () => patch(r.id, { status: "Reviewing" }) }] : []),
          { label: "Decline", icon: XCircle, danger: true, divider: true, onClick: () => patch(r.id, { status: "Declined" }) },
        ]} />
      </span>) },
  ];

  return (
    <PageShell>
      <PageHeader title="Requests" subtitle="Every customer ask in one inbox, before it becomes a work order."
        crumbs={[{ label: "Work" }, { label: "Requests" }]}
        actions={<PrimaryButton icon={Plus} onClick={() => setOpen(true)}>New request</PrimaryButton>} />

      <KpiRow cols="xl:grid-cols-4">
        <KpiTile label="New" value={counts.New} tone="purple" icon={Sparkle} active={statusF === "New"} onClick={() => setStatusF(statusF === "New" ? "All" : "New")} />
        <KpiTile label="Reviewing" value={counts.Reviewing} tone="amber" icon={MagnifyingGlass} active={statusF === "Reviewing"} onClick={() => setStatusF(statusF === "Reviewing" ? "All" : "Reviewing")} />
        <KpiTile label="Converted" value={counts.Converted} tone="green" icon={CheckCircle} active={statusF === "Converted"} onClick={() => setStatusF(statusF === "Converted" ? "All" : "Converted")} />
        <KpiTile label="Declined" value={counts.Declined} tone="gray" icon={XCircle} active={statusF === "Declined"} onClick={() => setStatusF(statusF === "Declined" ? "All" : "Declined")} />
      </KpiRow>

      <div className="mb-3"><Segmented value={view} onChange={setView} options={[{ value: "all", label: "All requests", count: (rows ?? []).length }, { value: "bookings", label: "Bookings to verify", count: toVerify.length }]} /></div>

      <ListCard>
        <FilterBar activeCount={sourceF !== ALL_SOURCES ? 1 : 0}
          search={<SearchBox value={search} onChange={setSearch} placeholder="Search requests, customers, sites…" className="w-full sm:w-auto sm:flex-1 min-w-[200px]" />}>
          <FilterSelect value={sourceF} options={[ALL_SOURCES, ...SOURCES]} onChange={setSourceF} className="flex-1 sm:flex-none min-w-[160px] sm:w-[180px]" />
        </FilterBar>
        <DataTable columns={columns} rows={filtered} pageSize={10} noun="requests" rowKey={r => r.id} minWidth={1000}
          empty={{ icon: Tray, title: rows === null ? "Loading requests…" : "No requests found", hint: rows === null ? "" : "New calls, emails, web forms and online bookings land here" }}
          mobileCard={r => (
            <div className="flex flex-col gap-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0"><p className="m-0 text-caption font-semibold text-blue-600">{r.number}</p>
                  <p className="m-0 text-label text-[var(--text-primary)]">{r.title}</p>
                  <p className="m-0 text-caption text-[var(--text-muted)]">{r.customerName} · {r.source}</p></div>
                <Pill tone={STATUS_TONE[r.status]}>{r.status}</Pill>
              </div>
            </div>)} />
      </ListCard>

      <SideDrawer open={open} onClose={() => setOpen(false)} icon={Tray} title="New request" subtitle="Log a call, email or walk-in before it becomes a work order"
        footer={<DrawerActions onCancel={() => setOpen(false)} onSubmit={submit} submitLabel={saving ? "Saving…" : "Log request"} disabled={saving} />}>
        <DrawerSection title="Customer">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2"><TextField label="Customer *" value={form.customerName} onChange={e => set("customerName", e.target.value)} error={!!errors.customerName} helperText={errors.customerName} size="small" fullWidth sx={FX} /></div>
            <TextField label="Contact" value={form.contactName} onChange={e => set("contactName", e.target.value)} size="small" fullWidth sx={FX} />
            <TextField label="Phone" value={form.phone} onChange={e => set("phone", e.target.value)} size="small" fullWidth sx={FX} />
            <div className="sm:col-span-2"><TextField label="Email" type="email" value={form.email} onChange={e => set("email", e.target.value)} size="small" fullWidth sx={FX} /></div>
            <div className="sm:col-span-2"><TextField label="Site or address" value={form.site} onChange={e => set("site", e.target.value)} size="small" fullWidth sx={FX} /></div>
          </div>
        </DrawerSection>
        <DrawerSection title="Request">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2"><TextField label="What needs doing? *" value={form.title} onChange={e => set("title", e.target.value)} error={!!errors.title} helperText={errors.title} size="small" fullWidth sx={FX} /></div>
            <FormControl size="small" fullWidth sx={FX}><InputLabel>Service type</InputLabel>
              <Select label="Service type" value={form.serviceType} onChange={e => set("serviceType", e.target.value)}>
                {SERVICE_TYPE_ORDER.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}</Select></FormControl>
            <FormControl size="small" fullWidth sx={FX}><InputLabel>Priority</InputLabel>
              <Select label="Priority" value={form.priority} onChange={e => set("priority", e.target.value)}>
                {["High", "Medium", "Low"].map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}</Select></FormControl>
            <FormControl size="small" fullWidth sx={FX}><InputLabel>Received via</InputLabel>
              <Select label="Received via" value={form.source} onChange={e => set("source", e.target.value)}>
                {SOURCES.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}</Select></FormControl>
            <TextField label="Campaign (optional)" value={form.campaign} onChange={e => set("campaign", e.target.value)} size="small" fullWidth sx={FX} />
            <div className="sm:col-span-2"><TextField label="Description" value={form.description} onChange={e => set("description", e.target.value)} size="small" fullWidth multiline rows={3} sx={FX} /></div>
          </div>
        </DrawerSection>
      </SideDrawer>
      {toastNode}
    </PageShell>
  );
}
