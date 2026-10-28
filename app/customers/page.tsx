"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import TextField from "@mui/material/TextField";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import {
  Plus, Buildings, Eye, ClipboardText, Wrench, CalendarBlank, Phone, MapPin, Cube,
} from "@phosphor-icons/react";
import {
  PageShell, PageHeader, PrimaryButton, ListCard, FilterBar, SearchBox, FilterSelect, DataTable, Stack, Pill, ActionMenu, useToast,
  SideDrawer, DrawerSection, DrawerActions, type Column, type PillTone,
} from "@/components/ui/ServiceOpsUI";
import { useJobFieldSx } from "@/components/jobs/jobFormStyles";
import { IconTile } from "@/components/dashboard/DashboardSection";
import { matchesQuery } from "@/lib/filtering";
import {
  CUSTOMERS, SERVICE_ZONES, customerStats, primaryContact, addCustomer, fmtDate, relDay, money, JOBS_TODAY_TS, DAY_MS,
  type Customer, type CustomerType, type CustomerStatus, type ServicePlan, type ServiceZone,
} from "@/lib/serviceData";

const TYPES: CustomerType[] = ["Industrial", "Commercial", "Healthcare", "Hospitality", "Retail", "Residential", "Education", "Public sector"];
const STATUS_TONE: Record<CustomerStatus, PillTone> = { Active: "green", "On hold": "amber", Inactive: "gray" };
const ALL_TYPES = "All customer types";
const ALL_LOC = "All locations";
const ALL_STATUS = "All status";
const ACTIVITY = ["Any activity", "Open work now", "Serviced in last 30 days", "Serviced in last 90 days", "No service in 90+ days"];
const STATES: Record<string, string> = { NY: "New York", NJ: "New Jersey", CT: "Connecticut" };

const EMPTY_FORM = {
  name: "", type: "Commercial" as CustomerType, plan: "Pay per visit" as ServicePlan, street: "", city: "", state: "NY", zip: "",
  phone: "", email: "", contactName: "", contactTitle: "", contactEmail: "", contactPhone: "", zone: "Central" as ServiceZone,
};

export default function CustomersPage() {
  const router = useRouter();
  const FX = useJobFieldSx();
  const { toastNode, notify } = useToast();
  const [version, setVersion] = useState(0);
  const [search, setSearch] = useState("");
  const [typeF, setTypeF] = useState(ALL_TYPES);
  const [locF, setLocF] = useState(ALL_LOC);
  const [statusF, setStatusF] = useState(ALL_STATUS);
  const [actF, setActF] = useState(ACTIVITY[0]);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [nameErr, setNameErr] = useState("");

  const rows = useMemo(() => CUSTOMERS.map(c => ({ c, s: customerStats(c), contact: primaryContact(c.id) })), [version]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => rows.filter(({ c, s, contact }) => {
    if (!matchesQuery(search, c.name, c.location, contact?.name, c.email, c.phone)) return false;
    if (typeF !== ALL_TYPES && c.type !== typeF) return false;
    if (locF !== ALL_LOC && STATES[c.location.slice(-2)] !== locF) return false;
    if (statusF !== ALL_STATUS && c.status !== statusF) return false;
    const since = s.lastService ? (JOBS_TODAY_TS - s.lastService) / DAY_MS : Infinity;
    if (actF === "Open work now" && s.openWOs.length + s.activeJobs.length === 0) return false;
    if (actF === "Serviced in last 30 days" && since > 30) return false;
    if (actF === "Serviced in last 90 days" && since > 90) return false;
    if (actF === "No service in 90+ days" && since <= 90) return false;
    return true;
  }), [rows, search, typeF, locF, statusF, actF]);

  type Row = typeof rows[number];
  const columns: Column<Row>[] = [
    {
      key: "name", header: "Customer", sortValue: r => r.c.name,
      cell: r => (
        <div className="flex items-center gap-3 min-w-0">
          <IconTile tone="blue" size={36}><Buildings size={18} weight="duotone" /></IconTile>
          <div className="min-w-0">
            <p className="m-0 text-table-cell font-semibold text-[var(--text-primary)] whitespace-nowrap">{r.c.name}</p>
            <p className="m-0 text-table-cell-secondary text-[var(--text-muted)] whitespace-nowrap">{r.c.type} · {r.c.plan}</p>
          </div>
        </div>
      ),
    },
    { key: "contact", header: "Primary contact", cell: r => <Stack top={r.contact?.name ?? "—"} bottom={r.contact?.phone} /> },
    { key: "location", header: "Location", cell: r => <Stack top={r.c.location} bottom={`${r.c.zone} zone`} />, sortValue: r => r.c.location },
    {
      key: "wos", header: "Open work orders", align: "right", sortValue: r => r.s.openWOs.length,
      cell: r => <span className={`text-table-cell ${r.s.openWOs.length ? "font-semibold text-[var(--text-primary)]" : "text-[var(--text-muted)]"}`}>{r.s.openWOs.length}</span>,
    },
    {
      key: "jobs", header: "Active jobs", align: "right", sortValue: r => r.s.activeJobs.length,
      cell: r => <span className={`text-table-cell ${r.s.activeJobs.length ? "font-semibold text-[var(--text-primary)]" : "text-[var(--text-muted)]"}`}>{r.s.activeJobs.length}</span>,
    },
    { key: "assets", header: "Assets", align: "right", sortValue: r => r.s.assets.length, cell: r => <span className="text-table-cell text-[var(--text-body)]">{r.s.assets.length}</span> },
    {
      key: "last", header: "Last service", sortValue: r => r.s.lastService ?? 0,
      cell: r => r.s.lastService ? <Stack top={fmtDate(r.s.lastService)} bottom={relDay(r.s.lastService)} /> : <span className="text-table-cell text-[var(--text-muted)]">No visits yet</span>,
    },
    {
      key: "balance", header: "Balance", align: "right", sortValue: r => r.s.balance,
      cell: r => r.s.balance ? (
        <Stack right top={money(r.s.balance)} bottom={r.s.overdue ? <span className="text-[#EF4444]">{money(r.s.overdue)} overdue</span> : "Not due yet"} />
      ) : <span className="text-table-cell text-[var(--text-muted)]">—</span>,
    },
    { key: "status", header: "Status", cell: r => <Pill tone={STATUS_TONE[r.c.status]}>{r.c.status}</Pill> },
    {
      key: "actions", header: "Actions", align: "right",
      cell: r => (
        <ActionMenu label={`Actions for ${r.c.name}`} actions={[
          { label: "View customer", icon: Eye, onClick: () => router.push(`/customers/${r.c.id}`) },
          { label: "Work orders", icon: ClipboardText, onClick: () => router.push(`/customers/${r.c.id}?tab=workorders`) },
          { label: "Assets", icon: Cube, onClick: () => router.push(`/customers/${r.c.id}?tab=assets`) },
        ]} />
      ),
    },
  ];

  const set = <K extends keyof typeof EMPTY_FORM>(k: K, v: (typeof EMPTY_FORM)[K]) => setForm(f => ({ ...f, [k]: v }));
  const closeAdd = () => { setAddOpen(false); setForm(EMPTY_FORM); setNameErr(""); };
  const submitAdd = () => {
    if (!form.name.trim()) { setNameErr("Customer name is required"); return; }
    if (CUSTOMERS.some(c => c.name.toLowerCase() === form.name.trim().toLowerCase())) { setNameErr("A customer with this name already exists"); return; }
    const c = addCustomer(form);
    closeAdd(); setVersion(v => v + 1);
    notify(`${c.name} added`, `/customers/${c.id}`);
  };
  const MI = { fontSize: "0.84rem" };

  return (
    <PageShell>
      <PageHeader title="Customers" subtitle="Who you service, where, and the state of each relationship."
        actions={<PrimaryButton icon={Plus} onClick={() => setAddOpen(true)}>Add customer</PrimaryButton>} />

      <ListCard>
        <FilterBar activeCount={[typeF !== ALL_TYPES, locF !== ALL_LOC, statusF !== ALL_STATUS, actF !== ACTIVITY[0]].filter(Boolean).length}
          search={<SearchBox value={search} onChange={setSearch} placeholder="Search customers, contacts, cities…" className="w-full sm:w-auto sm:flex-1 lg:flex-none lg:w-[280px]" />}>
          <FilterSelect value={typeF} options={[ALL_TYPES, ...TYPES]} onChange={setTypeF} className="flex-1 sm:flex-none min-w-[160px] sm:w-[190px]" />
          <FilterSelect value={locF} options={[ALL_LOC, ...Object.values(STATES)]} onChange={setLocF}
            icon={<MapPin size={18} className="flex-shrink-0 text-[var(--text-body)]" />} className="flex-1 sm:flex-none min-w-[160px] sm:w-[180px]" />
          <FilterSelect value={statusF} options={[ALL_STATUS, "Active", "On hold", "Inactive"]} onChange={setStatusF} className="flex-1 sm:flex-none min-w-[130px] sm:w-[150px]" />
          <FilterSelect value={actF} options={ACTIVITY} onChange={setActF}
            icon={<CalendarBlank size={18} className="flex-shrink-0 text-[var(--text-body)]" />} className="flex-1 sm:flex-none min-w-[200px] sm:w-[240px]" />
        </FilterBar>

        <DataTable columns={columns} rows={filtered} rowKey={r => r.c.id} onRowClick={r => router.push(`/customers/${r.c.id}`)}
          pageSize={10} noun="customers" minWidth={1180} defaultSort={{ key: "name", dir: "asc" }}
          empty={{ icon: Buildings, title: "No customers found", hint: "Try adjusting your search or filters" }}
          mobileCard={r => (
            <div className="flex flex-col gap-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="m-0 text-label text-[var(--text-primary)]">{r.c.name}</p>
                  <p className="m-0 text-caption text-[var(--text-muted)]">{r.c.type} · {r.c.location}</p>
                </div>
                <Pill tone={STATUS_TONE[r.c.status]}>{r.c.status}</Pill>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-caption text-[var(--text-body)]">
                <span className="inline-flex items-center gap-1"><ClipboardText size={14} /> {r.s.openWOs.length} open</span>
                <span className="inline-flex items-center gap-1"><Wrench size={14} /> {r.s.activeJobs.length} active jobs</span>
                {r.contact && <a href={`tel:${r.contact.phone.replace(/\s/g, "")}`} onClick={e => e.stopPropagation()} className="inline-flex items-center gap-1 text-blue-600"><Phone size={14} /> {r.contact.name}</a>}
              </div>
            </div>
          )} />
      </ListCard>

      <SideDrawer open={addOpen} onClose={closeAdd} icon={Buildings} title="Add customer" subtitle="Create the account — sites and assets can be added from the customer page"
        footer={<DrawerActions onCancel={closeAdd} onSubmit={submitAdd} submitLabel="Add customer" />}>
        <DrawerSection title="Organization">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <TextField label="Customer name *" value={form.name} onChange={e => { set("name", e.target.value); setNameErr(""); }} error={!!nameErr} helperText={nameErr} size="small" fullWidth sx={FX} />
            </div>
            <FormControl size="small" fullWidth sx={FX}>
              <InputLabel>Customer type</InputLabel>
              <Select label="Customer type" value={form.type} onChange={e => set("type", e.target.value as CustomerType)}>
                {TYPES.map(t => <MenuItem key={t} value={t} sx={MI}>{t}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl size="small" fullWidth sx={FX}>
              <InputLabel>Service plan</InputLabel>
              <Select label="Service plan" value={form.plan} onChange={e => set("plan", e.target.value as ServicePlan)}>
                {(["Gold AMC", "Silver AMC", "Pay per visit"] as ServicePlan[]).map(t => <MenuItem key={t} value={t} sx={MI}>{t}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField label="Main phone" value={form.phone} onChange={e => set("phone", e.target.value)} size="small" fullWidth sx={FX} />
            <TextField label="Main email" value={form.email} onChange={e => set("email", e.target.value)} size="small" fullWidth sx={FX} />
          </div>
        </DrawerSection>
        <DrawerSection title="Service address">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2"><TextField label="Street" value={form.street} onChange={e => set("street", e.target.value)} size="small" fullWidth sx={FX} /></div>
            <TextField label="City" value={form.city} onChange={e => set("city", e.target.value)} size="small" fullWidth sx={FX} />
            <div className="grid grid-cols-2 gap-3">
              <FormControl size="small" fullWidth sx={FX}>
                <InputLabel>State</InputLabel>
                <Select label="State" value={form.state} onChange={e => set("state", e.target.value)}>
                  {Object.keys(STATES).map(s => <MenuItem key={s} value={s} sx={MI}>{s}</MenuItem>)}
                </Select>
              </FormControl>
              <TextField label="ZIP" value={form.zip} onChange={e => set("zip", e.target.value)} size="small" fullWidth sx={FX} />
            </div>
            <FormControl size="small" fullWidth sx={FX}>
              <InputLabel>Service zone</InputLabel>
              <Select label="Service zone" value={form.zone} onChange={e => set("zone", e.target.value as ServiceZone)}>
                {SERVICE_ZONES.map(z => <MenuItem key={z} value={z} sx={MI}>{z}</MenuItem>)}
              </Select>
            </FormControl>
          </div>
        </DrawerSection>
        <DrawerSection title="Primary contact">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <TextField label="Name" value={form.contactName} onChange={e => set("contactName", e.target.value)} size="small" fullWidth sx={FX} />
            <TextField label="Title" placeholder="Facilities Manager" value={form.contactTitle} onChange={e => set("contactTitle", e.target.value)} size="small" fullWidth sx={FX} />
            <TextField label="Email" value={form.contactEmail} onChange={e => set("contactEmail", e.target.value)} size="small" fullWidth sx={FX} />
            <TextField label="Phone" value={form.contactPhone} onChange={e => set("contactPhone", e.target.value)} size="small" fullWidth sx={FX} />
          </div>
        </DrawerSection>
      </SideDrawer>

      {toastNode}
    </PageShell>
  );
}
