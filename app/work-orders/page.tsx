"use client";
import { useOpenOnNew } from "@/lib/useOpenOnNew";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import IconButton from "@mui/material/IconButton";
import {
  Plus, CalendarBlank, SlidersHorizontal, ClipboardText, Sparkle, HourglassMedium, CalendarCheck, Truck,
  Pulse, CheckCircle, Eye, XCircle, UserCircle, FileText,
} from "@phosphor-icons/react";
import FiltersDrawer, { type FilterRow } from "@/components/shared/FiltersDrawer";
import NewWorkOrderDrawer from "@/components/workorders/NewWorkOrderDrawer";
import { WO_STATUS_TONE, WOStatusPill, woSummary } from "@/components/workorders/woShared";
import {
  PageShell, PageHeader, PrimaryButton, KpiTile, KpiRow, FilterBar, ListCard, SearchBox, FilterSelect, DataTable,
  IdLink, PriorityTag, ServiceTypeCell, PersonCell, Stack, ActionMenu, useToast, Pill, type Column,
} from "@/components/ui/ServiceOpsUI";
import { SERVICE_TYPE_ORDER, TECHNICIANS } from "@/lib/jobsData";
import { matchesAdvanced, matchesQuery } from "@/lib/filtering";
import {
  WORK_ORDERS, WO_STATUS_ORDER, CUSTOMERS, DAY_MS, JOBS_TODAY_TS, fmtDate, fmtDay, fmtTime, relDay, logWO,
  type WorkOrder, type WOStatus,
} from "@/lib/serviceData";

const ALL_STATUS = "All status";
const ALL_CUSTOMERS = "All customers";

const ALL_TYPES = "All service types";
const ALL_PRIORITY = "Any priority";
const ALL_ASSIGNEES = "Any technician";
const UNASSIGNED = "Unassigned";
const DATE_PRESETS: { label: string; days: number | null }[] = [
  { label: "Any date",         days: null },
  { label: "Requested today", days: 1 },
  { label: "Last 7 days", days: 7 },
  { label: "Last 30 days", days: 30 },
];

const KPI: { status: WOStatus; label: string; tone: "purple" | "gray" | "amber" | "blue" | "green"; icon: typeof Sparkle }[] = [
  { status: "New",               label: "New",         tone: "purple", icon: Sparkle },
  { status: "Awaiting approval", label: "Approval",    tone: "gray",   icon: HourglassMedium },
  { status: "Ready to schedule", label: "To schedule", tone: "amber",  icon: Truck },
  { status: "Scheduled",         label: "Scheduled",         tone: "blue",   icon: CalendarCheck },
  { status: "In progress",       label: "In progress",       tone: "blue",   icon: Pulse },
  { status: "Completed",         label: "Completed",         tone: "green",  icon: CheckCircle },
];

// Status is filtered from the tiles above; "More filters" covers Cancelled and combinations.
const FILTER_COLUMNS = [
  { value: "number",      label: "Work order · Number" },
  { value: "title",       label: "Work order · Title" },
  { value: "customer",    label: "Work order · Customer" },
  { value: "serviceType", label: "Work order · Service type" },
  { value: "priority",    label: "Work order · Priority" },
  { value: "status",      label: "Work order · Status" },
  { value: "source",      label: "Work order · Received via" },
  { value: "zone",        label: "Work order · Service zone" },
  { value: "technician",  label: "Work order · Assigned to" },
];

export default function WorkOrdersPage() {
  const router = useRouter();
  const { toastNode, notify } = useToast();
  const [version, setVersion] = useState(0);
  const [search, setSearch] = useState("");
  const [statusF, setStatusF] = useState(ALL_STATUS);
  const [custF, setCustF] = useState(ALL_CUSTOMERS);
  const [typeF, setTypeF] = useState(ALL_TYPES);
  const [prioF, setPrioF] = useState(ALL_PRIORITY);
  const [techF, setTechF] = useState(ALL_ASSIGNEES);
  const [dateF, setDateF] = useState(DATE_PRESETS[0].label);
  const [adv, setAdv] = useState<FilterRow[]>([]);
  const [advAnchor, setAdvAnchor] = useState<HTMLElement | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  useOpenOnNew(() => setNewOpen(true));

  const rows = useMemo(() => WORK_ORDERS.map(wo => ({ wo, ...woSummary(wo) })), [version]); // eslint-disable-line react-hooks/exhaustive-deps

  const counts = useMemo(() => {
    const c = Object.fromEntries(WO_STATUS_ORDER.map(s => [s, 0])) as Record<WOStatus, number>;
    rows.forEach(r => { c[r.status] += 1; });
    return c;
  }, [rows]);

  const filtered = useMemo(() => {
    const days = DATE_PRESETS.find(p => p.label === dateF)?.days ?? null;
    const from = days === null ? -Infinity : JOBS_TODAY_TS - (days - 1) * DAY_MS;
    return rows.filter(r => {
      const { wo } = r;
      if (!matchesQuery(search, wo.number, wo.title, wo.customer, r.technician, r.asset?.name, r.asset?.serialNumber)) return false;
      if (statusF !== ALL_STATUS && r.status !== statusF) return false;
      if (custF !== ALL_CUSTOMERS && wo.customer !== custF) return false;
      if (typeF !== ALL_TYPES && wo.serviceType !== typeF) return false;
      if (prioF !== ALL_PRIORITY && wo.priority !== prioF) return false;
      if (techF === UNASSIGNED && r.technician) return false;
      if (techF !== ALL_ASSIGNEES && techF !== UNASSIGNED && r.technician !== techF) return false;
      if (wo.requestedAt < from) return false;
      return matchesAdvanced({
        number: wo.number, title: wo.title, customer: wo.customer, serviceType: wo.serviceType, priority: wo.priority,
        status: r.status, source: wo.source, zone: wo.zone, technician: r.technician ?? "",
      }, adv);
    });
  }, [rows, search, statusF, custF, typeF, prioF, techF, dateF, adv]);

  const reset = (fn: () => void) => fn();

  type Row = typeof rows[number];
  const columns: Column<Row>[] = [
    { key: "number", header: "Work order #", cell: r => <IdLink href={`/work-orders/${r.wo.id}`}>{r.wo.number}</IdLink>, sortValue: r => r.wo.number },
    {
      key: "title", header: "Title",
      cell: r => (
        <div className="max-w-[230px]">
          <p className="m-0 text-table-cell text-[var(--text-primary)] truncate">{r.wo.title}</p>
          <p className="m-0 text-table-cell-secondary text-[var(--text-muted)] truncate">{r.asset ? `${r.asset.name} · ${r.asset.model}` : "Site-wide request"}</p>
        </div>
      ),
    },
    { key: "customer", header: "Customer", cell: r => <Stack top={r.wo.customer} bottom={CUSTOMERS.find(c => c.id === r.wo.customerId)?.location} />, sortValue: r => r.wo.customer },
    { key: "type", header: "Service type", cell: r => <ServiceTypeCell type={r.wo.serviceType} />, hideBelow: "wide" },
    { key: "priority", header: "Priority", cell: r => <PriorityTag priority={r.wo.priority} />, sortValue: r => ["High", "Medium", "Low"].indexOf(r.wo.priority) },
    { key: "status", header: "Status", cell: r => <WOStatusPill wo={r.wo} />, sortValue: r => WO_STATUS_ORDER.indexOf(r.status) },
    { key: "created", header: "Created", hideBelow: "wide", cell: r => <Stack top={fmtDay(r.wo.requestedAt)} bottom={relDay(r.wo.requestedAt)} />, sortValue: r => r.wo.requestedAt },
    {
      key: "scheduled", header: "Scheduled",
      cell: r => r.scheduledAt
        ? <Stack top={fmtDay(r.scheduledAt)} bottom={fmtTime(r.scheduledAt)} />
        : <span className="text-table-cell text-[var(--text-muted)] whitespace-nowrap">{r.status === "Ready to schedule" ? "Not yet" : "—"}</span>,
      sortValue: r => r.scheduledAt ?? Number.MAX_SAFE_INTEGER,
    },
    {
      key: "tech", header: "Assigned to",
      cell: r => r.technician ? <PersonCell name={r.technician} size={28} /> : <span className="text-table-cell text-[var(--text-muted)]">Unassigned</span>,
    },
    {
      key: "actions", header: "Actions", align: "right",
      cell: r => (
        <span onClick={e => e.stopPropagation()}>
          <ActionMenu label={`Actions for ${r.wo.number}`} actions={[
            { label: "View work order", icon: Eye, onClick: () => router.push(`/work-orders/${r.wo.id}`) },
            ...(r.status === "Ready to schedule" ? [{ label: "Schedule in Dispatch", icon: Truck, onClick: () => router.push(`/dispatch?wo=${r.wo.id}`) }] : []),
            ...(r.latestJob ? [{ label: `Open ${r.latestJob.jobId}`, icon: ClipboardText, onClick: () => router.push(`/jobs/${r.latestJob!.id}`) }] : []),
            { label: "Estimate", icon: FileText, onClick: () => router.push(`/work-orders/${r.wo.id}?tab=estimate`) },
            {
              label: "Cancel work order", icon: XCircle, danger: true, divider: true, disabled: !!r.latestJob || r.status === "Cancelled",
              onClick: () => { r.wo.baseStatus = "Cancelled"; logWO(r.wo, "Work order cancelled"); setVersion(v => v + 1); notify(`${r.wo.number} cancelled`); },
            },
          ]} />
        </span>
      ),
    },
  ];

  return (
    <PageShell>
      <PageHeader title="Work Orders" subtitle="Service requests and their path from approval to the field."
        actions={<PrimaryButton icon={Plus} onClick={() => setNewOpen(true)}>New work order</PrimaryButton>} />

      {/* Status tiles double as quick filters — click again to clear */}
      <KpiRow>
        {KPI.map(k => (
          <KpiTile key={k.status} label={k.label} value={counts[k.status]} tone={k.tone} icon={k.icon}
            active={statusF === k.status} onClick={() => reset(() => setStatusF(statusF === k.status ? ALL_STATUS : k.status))} />
        ))}
      </KpiRow>

      <ListCard>
        <FilterBar activeCount={[custF !== ALL_CUSTOMERS, typeF !== ALL_TYPES, prioF !== ALL_PRIORITY, techF !== ALL_ASSIGNEES, dateF !== DATE_PRESETS[0].label].filter(Boolean).length + adv.length}
          search={<SearchBox value={search} onChange={v => reset(() => setSearch(v))} placeholder="Search work orders, assets, serials…"
            className="w-full sm:w-auto sm:flex-1 min-w-[200px]" />}
          trailing={
          <IconButton aria-label="More filters" onClick={e => setAdvAnchor(e.currentTarget)}
            sx={{
              width: 44, height: 44, borderRadius: "12px", flexShrink: 0,
              border: `1px solid ${adv.length ? "var(--serviceops-primary)" : "var(--border)"}`,
              bgcolor: adv.length ? "var(--serviceops-primary-10)" : "var(--bg-card)", color: "var(--text-primary)",
              "&:hover": { borderColor: "var(--serviceops-primary)", bgcolor: "var(--serviceops-primary-10)" },
            }}>
            <SlidersHorizontal size={20} />
          </IconButton>}>
          <FilterSelect value={custF} options={[ALL_CUSTOMERS, ...CUSTOMERS.map(c => c.name).sort()]} onChange={v => reset(() => setCustF(v))} className="flex-1 sm:flex-none min-w-[140px] sm:w-[160px]" />
          <FilterSelect value={typeF} options={[ALL_TYPES, ...SERVICE_TYPE_ORDER]} onChange={v => reset(() => setTypeF(v))} className="flex-1 sm:flex-none min-w-[140px] sm:w-[150px]" />
          <FilterSelect value={prioF} options={[ALL_PRIORITY, "High", "Medium", "Low"]} onChange={v => reset(() => setPrioF(v))} className="flex-1 sm:flex-none min-w-[120px] sm:w-[132px]" />
          <FilterSelect value={techF} options={[ALL_ASSIGNEES, UNASSIGNED, ...TECHNICIANS]} onChange={v => reset(() => setTechF(v))} className="flex-1 sm:flex-none min-w-[140px] sm:w-[156px]" />
          <FilterSelect value={dateF} options={DATE_PRESETS.map(p => p.label)} onChange={v => reset(() => setDateF(v))}
            icon={<CalendarBlank size={18} className="flex-shrink-0 text-[var(--text-body)]" />} className="flex-1 sm:flex-none min-w-[160px] sm:w-[176px]" />
        </FilterBar>

        <DataTable
          columns={columns}
          rows={filtered}
          pageSize={10}
          noun="work orders"
          rowKey={r => r.wo.id}
          onRowClick={r => router.push(`/work-orders/${r.wo.id}`)}
          minWidth={1060}
          empty={{ icon: ClipboardText, title: "No work orders found", hint: "Try adjusting your search or filters" }}
          mobileCard={r => (
            <div className="flex flex-col gap-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="m-0 text-caption font-semibold text-blue-600">{r.wo.number}</p>
                  <p className="m-0 text-label text-[var(--text-primary)]">{r.wo.title}</p>
                  <p className="m-0 text-caption text-[var(--text-muted)]">{r.wo.customer}</p>
                </div>
                <Pill tone={WO_STATUS_TONE[r.status]}>{r.status}</Pill>
              </div>
              <div className="flex items-center justify-between gap-3 text-caption text-[var(--text-body)]">
                <PriorityTag priority={r.wo.priority} />
                <span className="inline-flex items-center gap-1.5">
                  <UserCircle size={14} /> {r.technician ?? "Unassigned"}
                  {r.scheduledAt && <> · {fmtDate(r.scheduledAt)}</>}
                </span>
              </div>
            </div>
          )}
        />
      </ListCard>

      <FiltersDrawer anchor={advAnchor} onClose={() => setAdvAnchor(null)} filters={adv}
        onChange={v => reset(() => setAdv(v))} columns={FILTER_COLUMNS} subtitle="Narrow down work orders by conditions" />

      <NewWorkOrderDrawer open={newOpen} onClose={() => setNewOpen(false)}
        onCreated={wo => { reset(() => { setSearch(""); setStatusF(ALL_STATUS); setCustF(ALL_CUSTOMERS); setTypeF(ALL_TYPES); setPrioF(ALL_PRIORITY); setTechF(ALL_ASSIGNEES); setDateF(DATE_PRESETS[0].label); setAdv([]); }); setVersion(v => v + 1); notify(`${wo.number} created for ${wo.customer}`, `/work-orders/${wo.id}`); }} />

      {toastNode}
    </PageShell>
  );
}
