"use client";
import { useOpenOnNew } from "@/lib/useOpenOnNew";
import { useCallback, useEffect, useMemo, useState } from "react";
import TextField from "@mui/material/TextField";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import { Plus, Books, Wrench, Package, PencilSimple, Prohibit, ArrowsClockwise } from "@phosphor-icons/react";
import {
  PageShell, PageHeader, PrimaryButton, KpiTile, KpiRow, FilterBar, ListCard, SearchBox, FilterSelect, DataTable,
  Stack, ActionMenu, useToast, Pill, SideDrawer, DrawerSection, DrawerActions, type Column,
} from "@/components/ui/ServiceOpsUI";
import { useJobFieldSx } from "@/components/jobs/jobFormStyles";
import { SERVICE_TYPE_ORDER } from "@/lib/jobsData";
import { money } from "@/lib/serviceData";
import { matchesQuery } from "@/lib/filtering";

type Item = { id: string; kind: "service" | "product"; name: string; sku: string | null; unit: string; price: number; cost: number; taxable: boolean; serviceType: string | null; description: string | null; active: boolean };
const EMPTY = { id: "", kind: "service" as Item["kind"], name: "", sku: "", unit: "each", price: "", cost: "", taxable: true, serviceType: "", description: "" };
const ALL = "All items";
const margin = (i: Item) => (i.price > 0 ? Math.round(((i.price - i.cost) / i.price) * 100) : 0);

export default function CatalogPage() {
  const FX = useJobFieldSx();
  const { toastNode, notify } = useToast();
  const [rows, setRows] = useState<Item[] | null>(null);
  const [kindF, setKindF] = useState<"all" | Item["kind"]>("all");
  const [typeF, setTypeF] = useState(ALL);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  useOpenOnNew(() => { setForm(EMPTY); setOpen(true); });

  const load = useCallback(async () => { const r = await fetch("/api/catalog"); setRows(r.ok ? await r.json() : []); }, []);
  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => (rows ?? []).filter(i =>
    (kindF === "all" || i.kind === kindF) && (typeF === ALL || i.serviceType === typeF) && matchesQuery(search, i.name, i.sku, i.description)), [rows, kindF, typeF, search]);
  const services = (rows ?? []).filter(i => i.kind === "service" && i.active).length;
  const products = (rows ?? []).filter(i => i.kind === "product" && i.active).length;

  const edit = (i?: Item) => {
    setErrors({});
    setForm(i ? { id: i.id, kind: i.kind, name: i.name, sku: i.sku ?? "", unit: i.unit, price: String(i.price), cost: String(i.cost), taxable: i.taxable, serviceType: i.serviceType ?? "", description: i.description ?? "" } : EMPTY);
    setOpen(true);
  };
  const set = (k: keyof typeof EMPTY, v: string | boolean) => { setForm(f => ({ ...f, [k]: v })); setErrors(x => { const n = { ...x }; delete n[k]; return n; }); };

  const submit = async () => {
    const e: Record<string, string> = {};
    if (form.name.trim().length < 2) e.name = "Name is required";
    const price = Number(form.price);
    if (form.price === "" || Number.isNaN(price) || price < 0) e.price = "Enter a price";
    const cost = form.cost === "" ? 0 : Number(form.cost);
    if (Number.isNaN(cost) || cost < 0) e.cost = "Enter a valid cost";
    setErrors(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    const body = { kind: form.kind, name: form.name, sku: form.sku || undefined, unit: form.unit || "each", price, cost, taxable: form.taxable, serviceType: form.serviceType || undefined, description: form.description || undefined };
    const res = await fetch(form.id ? `/api/catalog/${form.id}` : "/api/catalog", { method: form.id ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setSaving(false);
    if (!res.ok) { notify(res.status === 403 ? "Only administrators and service managers can change the catalog" : "Could not save the item", undefined, "info"); return; }
    setOpen(false); await load(); notify(form.id ? "Catalog item updated" : "Catalog item added");
  };

  const toggle = async (i: Item) => {
    const res = await fetch(`/api/catalog/${i.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active: !i.active }) });
    if (res.ok) { await load(); notify(i.active ? `${i.name} deactivated` : `${i.name} reactivated`); } else notify("You do not have permission to change the catalog", undefined, "info");
  };

  const columns: Column<Item>[] = [
    { key: "name", header: "Item", sortValue: i => i.name, cell: i => (
      <div className="max-w-[280px]"><p className={`m-0 text-table-cell truncate ${i.active ? "text-[var(--text-primary)]" : "text-[var(--text-muted)] line-through"}`}>{i.name}</p>
        <p className="m-0 text-table-cell-secondary text-[var(--text-muted)] truncate">{i.sku ? `SKU ${i.sku}` : i.description ?? "—"}</p></div>) },
    { key: "kind", header: "Type", sortValue: i => i.kind, cell: i => <Pill tone={i.kind === "service" ? "blue" : "gray"}>{i.kind === "service" ? "Service" : "Product"}</Pill> },
    { key: "svc", header: "Service type", hideBelow: "xl", cell: i => <span className="text-table-cell">{i.serviceType ?? "Any"}</span> },
    { key: "unit", header: "Unit", hideBelow: "xl", cell: i => <span className="text-table-cell">{i.unit}</span> },
    { key: "price", header: "Price", align: "right", sortValue: i => i.price, cell: i => <span className="text-table-cell font-semibold">{money(i.price)}</span> },
    { key: "cost", header: "Cost", align: "right", sortValue: i => i.cost, cell: i => <span className="text-table-cell">{money(i.cost)}</span> },
    { key: "margin", header: "Margin", align: "right", sortValue: margin, cell: i => <Pill tone={margin(i) >= 40 ? "green" : margin(i) >= 20 ? "amber" : "red"} dot={false}>{margin(i)}%</Pill> },
    { key: "tax", header: "Tax", hideBelow: "xl", cell: i => <span className="text-table-cell">{i.taxable ? "Taxable" : "Exempt"}</span> },
    { key: "actions", header: "Actions", align: "right", cell: i => (
      <span onClick={e => e.stopPropagation()}>
        <ActionMenu label={`Actions for ${i.name}`} actions={[
          { label: "Edit", icon: PencilSimple, onClick: () => edit(i) },
          { label: i.active ? "Deactivate" : "Reactivate", icon: i.active ? Prohibit : ArrowsClockwise, danger: i.active, divider: true, onClick: () => toggle(i) },
        ]} />
      </span>) },
  ];

  return (
    <PageShell>
      <PageHeader title="Catalog" subtitle="Priced services and products used on estimates, work orders and invoices."
        crumbs={[{ label: "Records" }, { label: "Catalog" }]}
        actions={<PrimaryButton icon={Plus} onClick={() => edit()}>Add item</PrimaryButton>} />
      <KpiRow cols="xl:grid-cols-3">
        <KpiTile label="Services" value={services} tone="blue" icon={Wrench} active={kindF === "service"} onClick={() => setKindF(kindF === "service" ? "all" : "service")} />
        <KpiTile label="Products" value={products} tone="gray" icon={Package} active={kindF === "product"} onClick={() => setKindF(kindF === "product" ? "all" : "product")} />
        <KpiTile label="Inactive" value={(rows ?? []).filter(i => !i.active).length} tone="amber" icon={Prohibit} />
      </KpiRow>
      <ListCard>
        <FilterBar activeCount={typeF !== ALL ? 1 : 0}
          search={<SearchBox value={search} onChange={setSearch} placeholder="Search by name, SKU or description…" className="w-full sm:w-auto sm:flex-1 min-w-[200px]" />}>
          <FilterSelect value={typeF} options={[ALL, ...SERVICE_TYPE_ORDER]} onChange={setTypeF} className="flex-1 sm:flex-none min-w-[160px] sm:w-[180px]" />
        </FilterBar>
        <DataTable columns={columns} rows={filtered} pageSize={10} noun="items" rowKey={i => i.id} minWidth={960}
          empty={{ icon: Books, title: rows === null ? "Loading catalog…" : "No catalog items", hint: rows === null ? "" : "Add the services and parts you sell so quotes and invoices stay consistent" }}
          mobileCard={i => (<div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="m-0 text-label text-[var(--text-primary)]">{i.name}</p><p className="m-0 text-caption text-[var(--text-muted)]">{i.kind} · {i.unit}</p></div><span className="text-label font-semibold">{money(i.price)}</span></div>)} />
      </ListCard>

      <SideDrawer open={open} onClose={() => setOpen(false)} icon={Books} title={form.id ? "Edit catalog item" : "Add catalog item"} subtitle="Prices exclude tax; tax is applied at the rate in Settings"
        footer={<DrawerActions onCancel={() => setOpen(false)} onSubmit={submit} submitLabel={saving ? "Saving…" : form.id ? "Save changes" : "Add item"} disabled={saving} />}>
        <DrawerSection title="Item">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormControl size="small" fullWidth sx={FX} disabled={!!form.id}><InputLabel>Type</InputLabel>
              <Select label="Type" value={form.kind} onChange={e => set("kind", e.target.value)}><MenuItem value="service">Service</MenuItem><MenuItem value="product">Product</MenuItem></Select></FormControl>
            <FormControl size="small" fullWidth sx={FX}><InputLabel>Service type</InputLabel>
              <Select label="Service type" value={form.serviceType} onChange={e => set("serviceType", e.target.value)}>
                <MenuItem value=""><em>Any</em></MenuItem>{SERVICE_TYPE_ORDER.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}</Select></FormControl>
            <div className="sm:col-span-2"><TextField label="Name *" value={form.name} onChange={e => set("name", e.target.value)} error={!!errors.name} helperText={errors.name} size="small" fullWidth sx={FX} /></div>
            <TextField label="SKU" value={form.sku} onChange={e => set("sku", e.target.value)} size="small" fullWidth sx={FX} />
            <TextField label="Unit" value={form.unit} onChange={e => set("unit", e.target.value)} size="small" fullWidth sx={FX} />
            <div className="sm:col-span-2"><TextField label="Description" value={form.description} onChange={e => set("description", e.target.value)} size="small" fullWidth multiline rows={2} sx={FX} /></div>
          </div>
        </DrawerSection>
        <DrawerSection title="Pricing">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <TextField label="Price *" type="number" value={form.price} onChange={e => set("price", e.target.value)} error={!!errors.price} helperText={errors.price} size="small" fullWidth sx={FX} />
            <TextField label="Cost" type="number" value={form.cost} onChange={e => set("cost", e.target.value)} error={!!errors.cost} helperText={errors.cost ?? "Used for margin"} size="small" fullWidth sx={FX} />
            <div className="sm:col-span-2"><FormControlLabel control={<Checkbox size="small" checked={form.taxable} onChange={e => set("taxable", e.target.checked)} sx={{ "&.Mui-checked": { color: "var(--serviceops-primary)" } }} />} label="Taxable" /></div>
          </div>
        </DrawerSection>
      </SideDrawer>
      {toastNode}
    </PageShell>
  );
}
