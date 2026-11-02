"use client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Tray, Sparkle, MagnifyingGlass, CheckCircle, XCircle, ClipboardText, FileText, ArrowsClockwise } from "@phosphor-icons/react";
import {
  PageShell, PageHeader, PrimaryButton, KpiTile, KpiRow, FilterBar, ListCard, SearchBox, FilterSelect, DataTable,
  PriorityTag, ServiceTypeCell, Stack, ActionMenu, useToast, Pill, Segmented, type Column, type PillTone,
} from "@/components/ui/ServiceOpsUI";
import type { ServiceType } from "@/lib/jobsData";
import { fmtDay } from "@/lib/serviceData";
import { workOrderFromRequest, type Req } from "@/lib/requestFlow";
import { WORK_TYPES } from "@/lib/workTypes";
import { matchesQuery } from "@/lib/filtering";

const STATUSES = ["New", "Reviewing", "Converted", "Declined"] as const;
const STATUS_TONE: Record<Req["status"], PillTone> = { New: "purple", Reviewing: "amber", Converted: "green", Declined: "gray" };
const SOURCES = ["Phone", "Email", "Web form", "Online booking", "Customer portal", "Technician"];
const ALL_SOURCES = "All sources";
const ALL_TYPES = "All work types";
/** Relative age from the real clock (the sample dataset runs on its own fixed clock). */
const ago = (iso: string) => {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  if (m < 1440) return `${Math.round(m / 60)}h ago`;
  return `${Math.round(m / 1440)}d ago`;
};

export default function RequestsPage() {
  const router = useRouter();
  const { toastNode, notify } = useToast();
  const [rows, setRows] = useState<Req[] | null>(null);
  const [statusF, setStatusF] = useState<Req["status"] | "All">("All");
  const [view, setView] = useState<"all" | "bookings">("all");
  const [sourceF, setSourceF] = useState(ALL_SOURCES);
  const [search, setSearch] = useState("");
  const [typeF, setTypeF] = useState(ALL_TYPES);

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
    (typeF === ALL_TYPES || r.workType === typeF) &&
    matchesQuery(search, r.number, r.customerName, r.title, r.contactName, r.site)), [rows, statusF, sourceF, typeF, search, view]);

  const patch = async (id: string, body: object) => {
    const res = await fetch(`/api/requests/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) { notify("Could not update the request", undefined, "info"); return false; }
    await load();
    return true;
  };

  const convert = async (r: Req, needsEstimate: boolean) => {
    const wo = workOrderFromRequest(r, needsEstimate);
    if (await patch(r.id, { status: "Converted", convertedTo: `work-order:${wo.id}` })) {
      notify(`${r.number} converted to ${wo.number}${needsEstimate ? " (estimate required)" : ""}`, `/work-orders/${wo.id}`);
    }
  };

  const columns: Column<Req>[] = [
    { key: "number", header: "Request #", cell: r => <span className="text-table-cell font-semibold text-blue-600">{r.number}</span>, sortValue: r => r.number },
    { key: "title", header: "Request", cell: r => (
      <div className="max-w-[260px]"><p className="m-0 text-table-cell text-[var(--text-primary)] truncate">{r.title}</p>
        <p className="m-0 text-table-cell-secondary text-[var(--text-muted)] truncate">{r.site || "No site given"}</p></div>) },
    { key: "customer", header: "Customer", cell: r => <Stack top={r.customerName} bottom={r.contactName ?? undefined} />, sortValue: r => r.customerName },
    { key: "source", header: "Source", cell: r => <Stack top={r.source} bottom={r.campaign ?? undefined} />, sortValue: r => r.source },
    { key: "work", header: "Work type", cell: r => <Stack top={r.workType} bottom={r.serviceType} />, sortValue: r => r.workType },
    { key: "priority", header: "Priority", cell: r => <PriorityTag priority={r.priority} />, sortValue: r => ["High", "Medium", "Low"].indexOf(r.priority) },
    { key: "status", header: "Status", cell: r => <Pill tone={STATUS_TONE[r.status]}>{r.status}</Pill>, sortValue: r => STATUSES.indexOf(r.status) },
    { key: "received", header: "Received", cell: r => <Stack top={fmtDay(new Date(r.createdAt).getTime())} bottom={ago(r.createdAt)} />, sortValue: r => r.createdAt },
    { key: "actions", header: "Actions", align: "right", cell: r => (
      <span onClick={e => e.stopPropagation()}>
        <ActionMenu label={`Actions for ${r.number}`} actions={r.status === "Converted" || r.status === "Declined" ? [
          { label: "Open request", icon: MagnifyingGlass, onClick: () => router.push(`/requests/${r.number}`) },
          { label: "Reopen request", icon: ArrowsClockwise, onClick: () => patch(r.id, { status: "New" }) },
        ] : [
          { label: "Open request", icon: MagnifyingGlass, onClick: () => router.push(`/requests/${r.number}`) },
          ...(r.source === "Online booking" && r.status === "New" ? [{ label: "Verify booking", icon: CheckCircle, onClick: () => patch(r.id, { status: "Reviewing" }) }] : []),
          { label: "Convert to work order", icon: ClipboardText, onClick: () => convert(r, false) },
          { label: "Convert and request estimate", icon: FileText, onClick: () => convert(r, true) },
          ...(r.status === "New" ? [{ label: "Mark as reviewing", icon: MagnifyingGlass, onClick: () => patch(r.id, { status: "Reviewing" }) }] : []),
          { label: "Decline…", icon: XCircle, danger: true, divider: true, onClick: () => router.push(`/requests/${r.number}`) },
        ]} />
      </span>) },
  ];

  return (
    <PageShell>
      <PageHeader title="Requests" subtitle="Every customer ask in one inbox, before it becomes a work order."
        crumbs={[{ label: "Work" }, { label: "Requests" }]}
        actions={<PrimaryButton icon={Plus} href="/requests/new">New request</PrimaryButton>} />

      <KpiRow cols="xl:grid-cols-4">
        <KpiTile label="New" value={counts.New} tone="purple" icon={Sparkle} active={statusF === "New"} onClick={() => setStatusF(statusF === "New" ? "All" : "New")} />
        <KpiTile label="Reviewing" value={counts.Reviewing} tone="amber" icon={MagnifyingGlass} active={statusF === "Reviewing"} onClick={() => setStatusF(statusF === "Reviewing" ? "All" : "Reviewing")} />
        <KpiTile label="Converted" value={counts.Converted} tone="green" icon={CheckCircle} active={statusF === "Converted"} onClick={() => setStatusF(statusF === "Converted" ? "All" : "Converted")} />
        <KpiTile label="Declined" value={counts.Declined} tone="gray" icon={XCircle} active={statusF === "Declined"} onClick={() => setStatusF(statusF === "Declined" ? "All" : "Declined")} />
      </KpiRow>

      <div className="mb-3"><Segmented value={view} onChange={setView} options={[{ value: "all", label: "All requests", count: (rows ?? []).length }, { value: "bookings", label: "Bookings to verify", count: toVerify.length }]} /></div>

      <ListCard>
        <FilterBar activeCount={(sourceF !== ALL_SOURCES ? 1 : 0) + (typeF !== ALL_TYPES ? 1 : 0)}
          search={<SearchBox value={search} onChange={setSearch} placeholder="Search requests, customers, sites…" className="w-full sm:w-auto sm:flex-1 min-w-[200px]" />}>
          <FilterSelect value={typeF} options={[ALL_TYPES, ...WORK_TYPES]} onChange={setTypeF} className="flex-1 sm:flex-none min-w-[160px] sm:w-[180px]" />
          <FilterSelect value={sourceF} options={[ALL_SOURCES, ...SOURCES]} onChange={setSourceF} className="flex-1 sm:flex-none min-w-[160px] sm:w-[180px]" />
        </FilterBar>
        <DataTable columns={columns} rows={filtered} pageSize={10} noun="requests" rowKey={r => r.id} minWidth={1000} onRowClick={r => router.push(`/requests/${r.number}`)}
          empty={{ icon: Tray, title: rows === null ? "Loading requests…" : "No requests found", hint: rows === null ? "" : "New calls, emails, web forms and online bookings land here" }}
          mobileCard={r => (
            <div className="flex flex-col gap-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0"><p className="m-0 text-caption font-semibold text-blue-600">{r.number}</p>
                  <p className="m-0 text-label text-[var(--text-primary)]">{r.title}</p>
                  <p className="m-0 text-caption text-[var(--text-muted)]">{r.customerName} · {r.workType} · {r.source}</p></div>
                <Pill tone={STATUS_TONE[r.status]}>{r.status}</Pill>
              </div>
            </div>)} />
      </ListCard>

      {toastNode}
    </PageShell>
  );
}
