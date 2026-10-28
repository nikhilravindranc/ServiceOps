"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import TextField from "@mui/material/TextField";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Autocomplete from "@mui/material/Autocomplete";
import {
  Plus, Cube, WarningCircle, Wrench, CalendarCheck, ShieldWarning, Eye, ClipboardText, CalendarBlank,
} from "@phosphor-icons/react";
import {
  PageShell, PageHeader, PrimaryButton, KpiTile, KpiRow, FilterBar, ListCard, SearchBox, FilterSelect, DataTable, Stack, Pill, ActionMenu,
  useToast, SideDrawer, DrawerSection, DrawerActions, IdLink, SERVICE_ICON, type Column,
} from "@/components/ui/ServiceOpsUI";
import { ASSET_STATUS_TONE } from "@/components/assets/assetShared";
import NewWorkOrderDrawer from "@/components/workorders/NewWorkOrderDrawer";
import { useJobFieldSx } from "@/components/jobs/jobFormStyles";
import { matchesQuery } from "@/lib/filtering";
import { PRODUCT_MODELS } from "@/lib/jobsData";
import {
  ASSETS, CUSTOMERS, assetStatus, assetLastService, assetNextService, warrantyState, addAsset, fmtDate, relDay,
  JOBS_TODAY_TS, DAY_MS, toLocalInput, type AssetCategory, type AssetStatus,
} from "@/lib/serviceData";

const CATEGORIES: AssetCategory[] = ["HVAC", "Mechanical", "Plumbing", "Electrical", "Elevator"];
const ALL_CUST = "All customers";
const ALL_CAT = "All equipment";
const ALL_STATUS = "All status";
const NEXT = ["Any next service", "Overdue", "Due in 30 days", "Due in 90 days"];
type Quick = "all" | "attention" | "service" | "due" | "warranty";

export default function AssetsPage() {
  const router = useRouter();
  const FX = useJobFieldSx();
  const { toastNode, notify } = useToast();
  const [version, setVersion] = useState(0);
  const [search, setSearch] = useState("");
  const [custF, setCustF] = useState(ALL_CUST);
  const [catF, setCatF] = useState(ALL_CAT);
  const [statusF, setStatusF] = useState(ALL_STATUS);
  const [nextF, setNextF] = useState(NEXT[0]);
  const [quick, setQuick] = useState<Quick>("all");
  const [addOpen, setAddOpen] = useState(false);
  const [raiseFor, setRaiseFor] = useState<{ customer: string; assetId: number } | null>(null);
  const blank = { customer: "", name: "", category: "HVAC" as AssetCategory, manufacturer: "", model: "", serialNumber: "", site: "", installed: "", warranty: "" };
  const [form, setForm] = useState(blank);
  const [err, setErr] = useState<Record<string, string>>({});

  const rows = useMemo(() => ASSETS.map(a => ({
    a, status: assetStatus(a), last: assetLastService(a), next: assetNextService(a), warranty: warrantyState(a),
  })), [version]); // eslint-disable-line react-hooks/exhaustive-deps

  const kpi = useMemo(() => ({
    all: rows.length,
    attention: rows.filter(r => r.status === "Needs attention" || r.status === "Out of service").length,
    service: rows.filter(r => r.status === "Under service").length,
    due: rows.filter(r => r.next.at - JOBS_TODAY_TS < 30 * DAY_MS).length,
    warranty: rows.filter(r => r.warranty === "Expiring soon").length,
  }), [rows]);

  const filtered = useMemo(() => rows.filter(r => {
    const { a } = r;
    if (!matchesQuery(search, a.assetNo, a.name, a.model, a.serialNumber, a.customer, a.manufacturer, a.site)) return false;
    if (custF !== ALL_CUST && a.customer !== custF) return false;
    if (catF !== ALL_CAT && a.category !== catF) return false;
    if (statusF !== ALL_STATUS && r.status !== statusF) return false;
    const until = (r.next.at - JOBS_TODAY_TS) / DAY_MS;
    if (nextF === "Overdue" && until >= 0) return false;
    if (nextF === "Due in 30 days" && (until < 0 || until > 30)) return false;
    if (nextF === "Due in 90 days" && (until < 0 || until > 90)) return false;
    if (quick === "attention" && !(r.status === "Needs attention" || r.status === "Out of service")) return false;
    if (quick === "service" && r.status !== "Under service") return false;
    if (quick === "due" && until >= 30) return false;
    if (quick === "warranty" && r.warranty !== "Expiring soon") return false;
    return true;
  }), [rows, search, custF, catF, statusF, nextF, quick]);

  type Row = typeof rows[number];
  const columns: Column<Row>[] = [
    { key: "no", header: "Asset #", cell: r => <IdLink href={`/assets/${r.a.id}`}>{r.a.assetNo}</IdLink>, sortValue: r => r.a.assetNo },
    {
      key: "asset", header: "Asset", sortValue: r => r.a.name,
      cell: r => {
        const Icon = SERVICE_ICON[r.a.category];
        return (
          <div className="flex items-center gap-2.5 min-w-0">
            <Icon size={18} weight="fill" className="flex-shrink-0 text-[var(--text-primary)]" />
            <Stack top={r.a.name} bottom={r.a.tag} />
          </div>
        );
      },
    },
    { key: "customer", header: "Customer", cell: r => <Stack top={r.a.customer} bottom={r.a.site} />, sortValue: r => r.a.customer },
    { key: "model", header: "Model", cell: r => <Stack top={r.a.model} bottom={r.a.manufacturer} /> },
    { key: "serial", header: "Serial number", cell: r => <span className="text-table-cell text-[var(--text-body)] whitespace-nowrap">{r.a.serialNumber}</span> },
    { key: "status", header: "Status", cell: r => <Pill tone={ASSET_STATUS_TONE[r.status]}>{r.status}</Pill>, sortValue: r => ["Out of service", "Needs attention", "Under service", "Operational"].indexOf(r.status) },
    {
      key: "last", header: "Last service", hideBelow: "wide", sortValue: r => r.last ?? 0,
      cell: r => r.last ? <Stack top={fmtDate(r.last)} bottom={relDay(r.last)} /> : <span className="text-table-cell text-[var(--text-muted)]">—</span>,
    },
    {
      key: "next", header: "Next service", sortValue: r => r.next.at,
      cell: r => {
        const overdue = r.next.at < JOBS_TODAY_TS - DAY_MS / 2;
        return <Stack top={<span className={overdue ? "text-[#EF4444] font-medium" : ""}>{fmtDate(r.next.at)}</span>} bottom={r.next.jobId ? "Job booked" : overdue ? "PM overdue" : "PM due"} />;
      },
    },
    {
      key: "actions", header: "Actions", align: "right",
      cell: r => (
        <ActionMenu label={`Actions for ${r.a.assetNo}`} actions={[
          { label: "View asset", icon: Eye, onClick: () => router.push(`/assets/${r.a.id}`) },
          { label: "Service history", icon: CalendarBlank, onClick: () => router.push(`/assets/${r.a.id}?tab=history`) },
          { label: "Raise work order", icon: ClipboardText, onClick: () => setRaiseFor({ customer: r.a.customer, assetId: r.a.id }) },
        ]} />
      ),
    },
  ];

  const tile = (k: Quick) => () => setQuick(q => (q === k ? "all" : k));

  const submit = () => {
    const e: Record<string, string> = {};
    if (!form.customer) e.customer = "Choose a customer";
    if (!form.name.trim()) e.name = "Name the equipment";
    if (!form.model.trim()) e.model = "Model is required";
    if (!form.serialNumber.trim()) e.serialNumber = "Serial number is required";
    setErr(e);
    if (Object.keys(e).length) return;
    const installedOn = form.installed ? new Date(form.installed).getTime() : JOBS_TODAY_TS;
    const a = addAsset({
      customer: form.customer, name: form.name, category: form.category, manufacturer: form.manufacturer || form.model.split(" ")[0],
      model: form.model, serialNumber: form.serialNumber, site: form.site,
      installedOn, warrantyUntil: form.warranty ? new Date(form.warranty).getTime() : installedOn + 2 * 365 * DAY_MS,
    });
    setAddOpen(false); setForm(blank); setVersion(v => v + 1);
    notify(`${a.assetNo} registered for ${a.customer}`, `/assets/${a.id}`);
  };
  const MI = { fontSize: "0.84rem" };

  return (
    <PageShell>
      <PageHeader title="Assets" subtitle="Equipment you service — its condition, coverage and what's due next."
        actions={<PrimaryButton icon={Plus} onClick={() => setAddOpen(true)}>Register asset</PrimaryButton>} />

      <KpiRow cols="xl:grid-cols-5">
        <KpiTile label="Assets on file" value={kpi.all} tone="purple" icon={Cube} onClick={() => setQuick("all")} />
        <KpiTile label="Need attention" value={kpi.attention} tone="amber" icon={WarningCircle} active={quick === "attention"} onClick={tile("attention")} />
        <KpiTile label="Under service" value={kpi.service} tone="blue" icon={Wrench} weight="fill" active={quick === "service"} onClick={tile("service")} />
        <KpiTile label="Due in 30 days" value={kpi.due} tone="green" icon={CalendarCheck} active={quick === "due"} onClick={tile("due")} />
        <KpiTile label="Warranty ending" value={kpi.warranty} tone="red" icon={ShieldWarning} active={quick === "warranty"} onClick={tile("warranty")} />
      </KpiRow>

      <ListCard>
        <FilterBar activeCount={[custF !== ALL_CUST, catF !== ALL_CAT, statusF !== ALL_STATUS, nextF !== NEXT[0]].filter(Boolean).length}
          search={<SearchBox value={search} onChange={setSearch} placeholder="Search asset #, model, serial, customer…" className="w-full sm:w-auto sm:flex-1 min-w-[220px]" />}>
          <FilterSelect value={custF} options={[ALL_CUST, ...CUSTOMERS.map(c => c.name).sort()]} onChange={setCustF} className="flex-1 sm:flex-none min-w-[150px] sm:w-[190px]" />
          <FilterSelect value={catF} options={[ALL_CAT, ...CATEGORIES]} onChange={setCatF} className="flex-1 sm:flex-none min-w-[140px] sm:w-[160px]" />
          <FilterSelect value={statusF} options={[ALL_STATUS, "Operational", "Under service", "Needs attention", "Out of service"]} onChange={setStatusF} className="flex-1 sm:flex-none min-w-[140px] sm:w-[170px]" />
          <FilterSelect value={nextF} options={NEXT} onChange={setNextF} icon={<CalendarBlank size={18} className="flex-shrink-0 text-[var(--text-body)]" />} className="flex-1 sm:flex-none min-w-[180px] sm:w-[200px]" />
        </FilterBar>

        <DataTable columns={columns} rows={filtered} rowKey={r => r.a.id} onRowClick={r => router.push(`/assets/${r.a.id}`)}
          pageSize={10} noun="assets" minWidth={1080}
          empty={{ icon: Cube, title: "No assets found", hint: "Try adjusting your search or filters" }}
          mobileCard={r => (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="m-0 text-caption font-semibold text-blue-600">{r.a.assetNo}</p>
                  <p className="m-0 text-label text-[var(--text-primary)]">{r.a.name}</p>
                  <p className="m-0 text-caption text-[var(--text-muted)]">{r.a.customer} · {r.a.model}</p>
                </div>
                <Pill tone={ASSET_STATUS_TONE[r.status as AssetStatus]}>{r.status}</Pill>
              </div>
              <p className="m-0 text-caption text-[var(--text-body)]">S/N {r.a.serialNumber} · Next service {fmtDate(r.next.at)}</p>
            </div>
          )} />
      </ListCard>

      <SideDrawer open={addOpen} onClose={() => setAddOpen(false)} icon={Cube} title="Register asset" subtitle="Add equipment to a customer's register"
        footer={<DrawerActions onCancel={() => setAddOpen(false)} onSubmit={submit} submitLabel="Register asset" />}>
        <DrawerSection title="Owner & location">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Autocomplete options={CUSTOMERS.map(c => c.name)} value={form.customer || null} onChange={(_, v) => setForm(f => ({ ...f, customer: v ?? "" }))}
              renderInput={p => <TextField {...p} label="Customer *" size="small" error={!!err.customer} helperText={err.customer} sx={FX} />} />
            <TextField label="Site / location" placeholder="Building A - Roof" value={form.site} onChange={e => setForm(f => ({ ...f, site: e.target.value }))} size="small" fullWidth sx={FX} />
          </div>
        </DrawerSection>
        <DrawerSection title="Equipment">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <TextField label="Asset name *" placeholder="Rooftop HVAC Unit" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} error={!!err.name} helperText={err.name} size="small" fullWidth sx={FX} />
            <FormControl size="small" fullWidth sx={FX}>
              <InputLabel>Equipment type</InputLabel>
              <Select label="Equipment type" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value as AssetCategory }))}>
                {CATEGORIES.map(c => <MenuItem key={c} value={c} sx={MI}>{c}</MenuItem>)}
              </Select>
            </FormControl>
            <Autocomplete freeSolo options={PRODUCT_MODELS[form.category]} value={form.model} onInputChange={(_, v) => setForm(f => ({ ...f, model: v }))}
              renderInput={p => <TextField {...p} label="Model *" size="small" error={!!err.model} helperText={err.model} sx={FX} />} />
            <TextField label="Manufacturer" value={form.manufacturer} onChange={e => setForm(f => ({ ...f, manufacturer: e.target.value }))} size="small" fullWidth sx={FX} />
            <TextField label="Serial number *" value={form.serialNumber} onChange={e => setForm(f => ({ ...f, serialNumber: e.target.value }))} error={!!err.serialNumber} helperText={err.serialNumber} size="small" fullWidth sx={FX} />
            <div />
            <TextField label="Installed on" type="date" value={form.installed} onChange={e => setForm(f => ({ ...f, installed: e.target.value }))} size="small" fullWidth InputLabelProps={{ shrink: true }} sx={FX} />
            <TextField label="Warranty until" type="date" value={form.warranty} onChange={e => setForm(f => ({ ...f, warranty: e.target.value }))} size="small" fullWidth InputLabelProps={{ shrink: true }}
              helperText="Defaults to 2 years from installation" inputProps={{ min: form.installed || toLocalInput(JOBS_TODAY_TS).slice(0, 10) }} sx={FX} />
          </div>
        </DrawerSection>
      </SideDrawer>

      <NewWorkOrderDrawer open={!!raiseFor} onClose={() => setRaiseFor(null)} defaultCustomer={raiseFor?.customer} defaultAssetId={raiseFor?.assetId}
        onCreated={wo => notify(`${wo.number} raised for ${wo.customer}`, `/work-orders/${wo.id}`)} />

      {toastNode}
    </PageShell>
  );
}
