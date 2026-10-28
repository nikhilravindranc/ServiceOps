"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import Avatar from "@mui/material/Avatar";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Autocomplete from "@mui/material/Autocomplete";
import {
  Package, Warning, ArrowsClockwise, ArrowUUpLeft, Truck, Plus, ArrowSquareOut, Eye, CheckCircle, HandArrowDown,
  Warehouse, Van, Info, PlugsConnected,
} from "@phosphor-icons/react";
import {
  PageShell, PageHeader, PrimaryButton, SecondaryButton, KpiTile, KpiRow, ListCard, SearchBox, FilterSelect, DataTable, Stack, Pill,
  ActionMenu, useToast, SideDrawer, DrawerSection, DrawerActions, KV, DetailTabs, PersonCell, MiniTable, type Column, type PillTone,
} from "@/components/ui/ServiceOpsUI";
import { STOCK_TONE } from "@/components/assets/assetShared";
import { useJobFieldSx } from "@/components/jobs/jobFormStyles";
import { matchesQuery } from "@/lib/filtering";
import { ALL_JOBS, TECHNICIANS } from "@/lib/jobsData";
import {
  PARTS, PART_REQUESTS, PART_RETURNS, TECH_PROFILES, SERVICE_PRICING, available, techStockTotal, partDemand, partUsed30,
  stockState, workOrderById, fmtDate, fmtDay, money, JOBS_TODAY_TS, DAY_MS, datasetNow,
  type Part, type PartRequestStatus, type ReturnStatus,
} from "@/lib/serviceData";

type Tab = "parts" | "vans" | "requests" | "returns";
const REQ_TONE: Record<PartRequestStatus, PillTone> = { Requested: "purple", Approved: "blue", Picked: "blue", Delivered: "green", "Back-ordered": "red" };
const RET_TONE: Record<ReturnStatus, PillTone> = { "Pending inspection": "amber", Restocked: "green", "Sent to vendor": "gray" };
const CATS = ["All categories", "HVAC", "Mechanical", "Plumbing", "Electrical", "Elevator", "Preventive"];
const STOCK = ["Any stock level", "Short for jobs", "Low stock", "Out of stock", "In stock"];
const partNo = (no: string) => PARTS.find(p => p.partNo === no);

export default function InventoryView() {
  const params = useSearchParams();
  const FX = useJobFieldSx();
  const { toastNode, notify } = useToast();
  const [version, setVersion] = useState(0);
  const refresh = () => setVersion(v => v + 1);
  const [tab, setTab] = useState<Tab>("parts");
  const [search, setSearch] = useState("");
  const [catF, setCatF] = useState(CATS[0]);
  const [stockF, setStockF] = useState(STOCK[0]);
  const [openPart, setOpenPart] = useState<Part | null>(null);
  const [reqOpen, setReqOpen] = useState(false);
  const [req, setReq] = useState({ partNo: "", qty: 1, technician: TECHNICIANS[0] as string, jobId: "" as number | "" });

  // Deep link from an asset's Parts tab or global search.
  useEffect(() => {
    const p = params.get("part");
    const part = p ? partNo(p) : undefined;
    if (part) setOpenPart(part);
  }, [params]);

  const rows = useMemo(() => PARTS.map(p => ({ p, demand: partDemand(p), used: partUsed30(p), stock: stockState(p), vans: techStockTotal(p), avail: available(p) })), [version]); // eslint-disable-line react-hooks/exhaustive-deps
  const filtered = useMemo(() => rows.filter(r =>
    matchesQuery(search, r.p.name, r.p.partNo, r.p.category)
    && (catF === CATS[0] || r.p.category === catF)
    && (stockF === STOCK[0] || r.stock === stockF)
  ), [rows, search, catF, stockF]);

  const short = rows.filter(r => r.stock === "Short for jobs" || r.stock === "Out of stock").length;
  const low = rows.filter(r => r.stock === "Low stock").length;
  const openReq = PART_REQUESTS.filter(r => r.status !== "Delivered").length;
  const pendingRet = PART_RETURNS.filter(r => r.status === "Pending inspection").length;

  type Row = typeof rows[number];
  const columns: Column<Row>[] = [
    { key: "part", header: "Part", sortValue: r => r.p.name, cell: r => <Stack top={r.p.name} bottom={r.p.category} /> },
    { key: "no", header: "Part number", cell: r => <span className="text-[var(--text-body)] whitespace-nowrap">{r.p.partNo}</span> },
    { key: "avail", header: "Available", align: "right", sortValue: r => r.avail, cell: r => <span className="text-table-cell font-semibold text-[var(--text-primary)]">{r.avail}</span> },
    { key: "res", header: "Reserved", align: "right", sortValue: r => r.p.reserved, cell: r => <span className="text-table-cell text-[var(--text-body)]">{r.p.reserved}</span> },
    { key: "vans", header: "Technician stock", align: "right", sortValue: r => r.vans, cell: r => <span className="text-table-cell text-[var(--text-body)]">{r.vans}</span> },
    {
      key: "req", header: "Required", align: "right", sortValue: r => r.demand.required,
      cell: r => r.demand.required ? (
        <Stack right top={<span className={r.stock === "Short for jobs" ? "text-[#EF4444] font-semibold" : "font-semibold"}>{r.demand.required}</span>} bottom={`${r.demand.jobs.length} job${r.demand.jobs.length === 1 ? "" : "s"} · 7 days`} />
      ) : <span className="text-table-cell text-[var(--text-muted)]">—</span>,
    },
    { key: "used", header: "Used", align: "right", sortValue: r => r.used, cell: r => <Stack right top={r.used || "—"} bottom={r.used ? "last 30 days" : undefined} /> },
    { key: "stock", header: "Stock", sortValue: r => STOCK.indexOf(r.stock), cell: r => <Pill tone={STOCK_TONE[r.stock]}>{r.stock}</Pill> },
    {
      key: "actions", header: "Actions", align: "right",
      cell: r => (
        <ActionMenu label={`Actions for ${r.p.partNo}`} actions={[
          { label: "View part", icon: Eye, onClick: () => setOpenPart(r.p) },
          { label: "Request for a job", icon: HandArrowDown, onClick: () => { setReq(q => ({ ...q, partNo: r.p.partNo })); setReqOpen(true); } },
          { label: "Reorder in EVOQ Inventory", icon: ArrowSquareOut, onClick: () => notify(`Reorder for ${r.p.partNo} sent to EVOQ Inventory`, undefined, "info") },
        ]} />
      ),
    },
  ];

  // ── Van stock: what each technician carries vs. what their next 3 days need ──
  const vans = useMemo(() => TECH_PROFILES.map(t => {
    const upcoming = ALL_JOBS.filter(j => j.technician === t.name && !["Completed", "Cancelled"].includes(j.status) && j.scheduledAt < JOBS_TODAY_TS + 3 * DAY_MS);
    const need = new Map<string, number>();
    upcoming.forEach(j => SERVICE_PRICING[j.serviceType].parts.forEach(l => need.set(l.item, (need.get(l.item) ?? 0) + l.qty)));
    const gaps = Array.from(need.entries()).map(([item, qty]) => {
      const p = PARTS.find(x => x.name === item);
      const carried = p?.techStock[t.name] ?? 0;
      return { item, partNo: p?.partNo ?? "", need: qty, carried, short: Math.max(0, qty - carried) };
    }).filter(g => g.short > 0);
    const skus = PARTS.filter(p => (p.techStock[t.name] ?? 0) > 0);
    return { t, upcoming: upcoming.length, skus: skus.length, units: skus.reduce((s, p) => s + (p.techStock[t.name] ?? 0), 0), gaps };
  }), [version]); // eslint-disable-line react-hooks/exhaustive-deps

  const restockVan = (name: string, gaps: { partNo: string; short: number }[]) => {
    gaps.forEach(g => {
      const p = partNo(g.partNo);
      if (!p) return;
      PART_REQUESTS.unshift({ id: `PR-${String(500 + PART_REQUESTS.length).padStart(4, "0")}`, partNo: g.partNo, qty: g.short, technician: name, jobId: null, woId: null, neededBy: JOBS_TODAY_TS + DAY_MS, status: "Requested", raisedAt: datasetNow() });
    });
    refresh(); notify(`Restock requested for ${name.split(" ")[0]}'s van (${gaps.length} part${gaps.length === 1 ? "" : "s"})`);
  };

  const submitReq = () => {
    const p = partNo(req.partNo);
    if (!p) return;
    const id = `PR-${String(500 + PART_REQUESTS.length).padStart(4, "0")}`;
    const job = req.jobId ? ALL_JOBS.find(j => j.id === req.jobId) : undefined;
    PART_REQUESTS.unshift({ id, partNo: p.partNo, qty: req.qty, technician: req.technician, jobId: job?.id ?? null, woId: null, neededBy: job?.scheduledAt ?? JOBS_TODAY_TS + DAY_MS, status: "Requested", raisedAt: datasetNow() });
    setReqOpen(false); setTab("requests"); refresh();
    notify(`${id} raised — ${req.qty} × ${p.name}`);
  };

  const advance = (id: string, status: PartRequestStatus) => {
    const r = PART_REQUESTS.find(x => x.id === id);
    if (!r) return;
    r.status = status;
    if (status === "Picked") { const p = partNo(r.partNo); if (p) { p.onHand = Math.max(0, p.onHand - r.qty); } }
    if (status === "Delivered") { const p = partNo(r.partNo); if (p) p.techStock[r.technician] = (p.techStock[r.technician] ?? 0) + r.qty; }
    refresh(); notify(`${id} marked ${status.toLowerCase()}`);
  };

  const demandJobs = openPart ? partDemand(openPart).jobs.map(d => ({ ...d, job: ALL_JOBS.find(j => j.id === d.jobId)! })).filter(d => d.job) : [];

  return (
    <PageShell>
      <PageHeader title="Inventory" subtitle="Parts for field work — what's on hand, in vans, and needed for upcoming jobs."
        actions={
          <>
            <SecondaryButton icon={PlugsConnected} href="/integrations" className="hidden md:inline-flex">EVOQ Inventory</SecondaryButton>
            <PrimaryButton icon={Plus} onClick={() => setReqOpen(true)}>Request parts</PrimaryButton>
          </>
        } />

      <KpiRow cols="md:grid-cols-4 xl:grid-cols-4">
        <KpiTile label="Short for upcoming jobs" value={short} tone="red" icon={Warning} active={stockF === "Short for jobs"} onClick={() => { setTab("parts"); setStockF(s => (s === "Short for jobs" ? STOCK[0] : "Short for jobs")); }} />
        <KpiTile label="Below reorder point" value={low} tone="amber" icon={Package} active={stockF === "Low stock"} onClick={() => { setTab("parts"); setStockF(s => (s === "Low stock" ? STOCK[0] : "Low stock")); }} />
        <KpiTile label="Open part requests" value={openReq} tone="blue" icon={ArrowsClockwise} weight="bold" active={tab === "requests"} onClick={() => setTab("requests")} />
        <KpiTile label="Returns to inspect" value={pendingRet} tone="purple" icon={ArrowUUpLeft} weight="bold" active={tab === "returns"} onClick={() => setTab("returns")} />
      </KpiRow>

      <ListCard>
        <DetailTabs label="Inventory views" active={tab} onChange={setTab} tabs={[
          { key: "parts", label: "Parts", count: PARTS.length },
          { key: "vans", label: "Technician stock" },
          { key: "requests", label: "Requests", count: openReq },
          { key: "returns", label: "Returns", count: PART_RETURNS.length },
        ]} />

        {tab === "parts" && (
          <>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <SearchBox value={search} onChange={setSearch} placeholder="Search part name or number…" className="w-full sm:w-auto sm:flex-1 lg:flex-none lg:w-[300px]" />
              <FilterSelect value={catF} options={CATS} onChange={setCatF} className="flex-1 sm:flex-none min-w-[150px] sm:w-[170px]" />
              <FilterSelect value={stockF} options={STOCK} onChange={setStockF} className="flex-1 sm:flex-none min-w-[160px] sm:w-[180px]" />
            </div>
            <DataTable columns={columns} rows={filtered} rowKey={r => r.p.partNo} onRowClick={r => setOpenPart(r.p)} pageSize={10} noun="parts" minWidth={1040}
              defaultSort={{ key: "stock", dir: "asc" }}
              empty={{ icon: Package, title: "No parts match", hint: "Try a different search or stock filter" }}
              mobileCard={r => (
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0"><p className="m-0 text-label text-[var(--text-primary)]">{r.p.name}</p><p className="m-0 text-caption text-[var(--text-muted)]">{r.p.partNo}</p></div>
                    <Pill tone={STOCK_TONE[r.stock]}>{r.stock}</Pill>
                  </div>
                  <p className="m-0 text-caption text-[var(--text-body)]">{r.avail} available · {r.vans} in vans · {r.demand.required} needed this week</p>
                </div>
              )} />
          </>
        )}

        {tab === "vans" && (
          <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-3">
            {vans.map(v => (
              <div key={v.t.name} className="rounded-xl border border-[var(--border-soft)] p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between gap-3">
                  <PersonCell name={v.t.name} src={v.t.avatar} size={36} sub={<span className="inline-flex items-center gap-1"><Van size={12} />{v.t.van} · {v.skus} parts · {v.units} units</span>} />
                  {v.gaps.length > 0
                    ? <Button size="small" variant="contained" onClick={() => restockVan(v.t.name, v.gaps)}>Restock van</Button>
                    : <Pill tone="green">Ready</Pill>}
                </div>
                {v.gaps.length > 0 ? (
                  <div className="rounded-lg bg-[var(--serviceops-tint)] px-3 py-2">
                    <p className="m-0 mb-1 text-caption text-[var(--text-muted)]">Short for {v.upcoming} job{v.upcoming === 1 ? "" : "s"} in the next 3 days</p>
                    <ul className="m-0 p-0 list-none flex flex-col gap-0.5">
                      {v.gaps.map(g => <li key={g.item} className="flex justify-between text-body"><span className="text-[var(--text-primary)]">{g.item}</span><span className="text-[var(--text-body)]">needs {g.need} · carries {g.carried}</span></li>)}
                    </ul>
                  </div>
                ) : <p className="m-0 text-caption text-[var(--text-muted)]">{v.upcoming ? `Carrying what the next ${v.upcoming} job${v.upcoming === 1 ? "" : "s"} need.` : "No jobs in the next 3 days."}</p>}
              </div>
            ))}
          </div>
        )}

        {tab === "requests" && (
          <div className="mt-2">
            <MiniTable head={["Request #", "Part", { label: "Qty", right: true }, "For", "Technician", "Needed by", "Status", ""]} minWidth={980}>
              {PART_REQUESTS.map(r => {
                const p = partNo(r.partNo);
                const job = r.jobId ? ALL_JOBS.find(j => j.id === r.jobId) : undefined;
                const wo = r.woId ? workOrderById(r.woId) : undefined;
                const next: PartRequestStatus | null = r.status === "Requested" ? "Approved" : r.status === "Approved" ? "Picked" : r.status === "Picked" ? "Delivered" : null;
                return (
                  <tr key={r.id}>
                    <td className="px-4 text-table-cell font-semibold text-[var(--text-primary)] whitespace-nowrap">{r.id}</td>
                    <td className="px-4"><Stack top={p?.name ?? r.partNo} bottom={r.partNo} /></td>
                    <td className="px-4 text-right text-table-cell text-[var(--text-primary)]">{r.qty}</td>
                    <td className="px-4 text-table-cell whitespace-nowrap">
                      {job ? <Link href={`/jobs/${job.id}`} className="text-blue-600 hover:underline">{job.jobId}</Link>
                        : wo ? <Link href={`/work-orders/${wo.id}`} className="text-blue-600 hover:underline">{wo.number}</Link>
                        : <span className="text-[var(--text-muted)]">Van restock</span>}
                    </td>
                    <td className="px-4 text-table-cell text-[var(--text-body)] whitespace-nowrap">{r.technician}</td>
                    <td className="px-4 text-table-cell text-[var(--text-body)] whitespace-nowrap">{fmtDay(r.neededBy)}</td>
                    <td className="px-4"><Pill tone={REQ_TONE[r.status]}>{r.status}</Pill></td>
                    <td className="px-4 text-right whitespace-nowrap">
                      {next && <Button size="small" variant="outlined" onClick={() => advance(r.id, next)}>{next === "Approved" ? "Approve" : next === "Picked" ? "Mark picked" : "Mark delivered"}</Button>}
                    </td>
                  </tr>
                );
              })}
            </MiniTable>
          </div>
        )}

        {tab === "returns" && (
          <div className="mt-2">
            <MiniTable head={["Return #", "Part", { label: "Qty", right: true }, "From job", "Technician", "Reason", "Received", "Status", ""]} minWidth={980}>
              {PART_RETURNS.map(r => {
                const p = partNo(r.partNo);
                const live = ALL_JOBS.find(j => j.jobId === r.jobRef);
                return (
                  <tr key={r.id}>
                    <td className="px-4 text-table-cell font-semibold text-[var(--text-primary)] whitespace-nowrap">{r.id}</td>
                    <td className="px-4"><Stack top={p?.name ?? r.partNo} bottom={r.partNo} /></td>
                    <td className="px-4 text-right text-table-cell text-[var(--text-primary)]">{r.qty}</td>
                    <td className="px-4 text-table-cell whitespace-nowrap">{live ? <Link href={`/jobs/${live.id}`} className="text-blue-600 hover:underline">{r.jobRef}</Link> : <span className="text-[var(--text-body)]">{r.jobRef}</span>}</td>
                    <td className="px-4 text-table-cell text-[var(--text-body)] whitespace-nowrap">{r.technician}</td>
                    <td className="px-4 text-table-cell text-[var(--text-body)] whitespace-nowrap">{r.reason}</td>
                    <td className="px-4 text-table-cell text-[var(--text-body)] whitespace-nowrap">{fmtDate(r.at)}</td>
                    <td className="px-4"><Pill tone={RET_TONE[r.status]}>{r.status}</Pill></td>
                    <td className="px-4 text-right whitespace-nowrap">
                      {r.status === "Pending inspection" && (
                        <Button size="small" variant="outlined" onClick={() => {
                          r.status = r.reason === "Defective" || r.reason === "Core return" ? "Sent to vendor" : "Restocked";
                          if (r.status === "Restocked" && p) p.onHand += r.qty;
                          refresh(); notify(`${r.id} ${r.status.toLowerCase()}`);
                        }}>{r.reason === "Defective" || r.reason === "Core return" ? "Send to vendor" : "Restock"}</Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </MiniTable>
          </div>
        )}
      </ListCard>

      <p className="m-0 flex items-center gap-2 text-caption text-[var(--text-muted)]">
        <Info size={14} /> Warehouse transfers, purchasing and stock counts are managed in EVOQ Inventory. Quantities here sync every 15 minutes.
      </p>

      {/* ── Part detail ── */}
      <SideDrawer open={!!openPart} onClose={() => setOpenPart(null)} icon={Package} title={openPart?.name ?? ""} subtitle={openPart ? `${openPart.partNo} · ${openPart.category}` : ""}
        footer={openPart ? (
          <>
            <Button variant="text" onClick={() => setOpenPart(null)} sx={{ color: "var(--text-muted)" }}>Close</Button>
            <Button variant="contained" onClick={() => { setReq(q => ({ ...q, partNo: openPart.partNo })); setOpenPart(null); setReqOpen(true); }}>Request for a job</Button>
          </>
        ) : undefined}>
        {openPart && (() => {
          const st = stockState(openPart);
          const vansWith = Object.entries(openPart.techStock).filter(([, q]) => q > 0);
          return (
            <>
              <div className="flex items-center gap-2"><Pill tone={STOCK_TONE[st]}>{st}</Pill><span className="text-caption text-[var(--text-muted)]">Unit cost {money(openPart.unitCost)} per {openPart.unit}</span></div>
              <DrawerSection title="Where it is">
                <KV label="Main warehouse — on hand">{openPart.onHand}</KV>
                <KV label="Reserved for jobs">{openPart.reserved}</KV>
                <KV label="Available to issue"><span className="font-semibold">{available(openPart)}</span></KV>
                <KV label="Reorder point">{openPart.reorderPoint}</KV>
                {vansWith.length === 0 ? <KV label="Technician vans">None carried</KV> : vansWith.map(([t, q]) => <KV key={t} label={`${t}'s van`}>{q}</KV>)}
              </DrawerSection>
              <DrawerSection title={`Needed in the next 7 days · ${partDemand(openPart).required}`}>
                {demandJobs.length === 0 ? <p className="m-0 text-body text-[var(--text-muted)]">No upcoming jobs need this part.</p> : (
                  <ul className="m-0 p-0 list-none flex flex-col">
                    {demandJobs.map(d => (
                      <li key={d.jobId} className="flex items-center justify-between gap-3 py-2 border-b border-[var(--border-soft)] last:border-b-0">
                        <span className="min-w-0"><Link href={`/jobs/${d.jobId}`} className="text-body font-semibold text-blue-600 hover:underline">{d.job.jobId}</Link><span className="block text-caption text-[var(--text-muted)] truncate">{d.job.customer} · {d.job.technician} · {d.job.scheduledDate}</span></span>
                        <span className="text-body text-[var(--text-primary)] whitespace-nowrap">× {d.qty}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </DrawerSection>
              <DrawerSection title="Recent movement">
                <KV label="Used in the last 30 days">{partUsed30(openPart)}</KV>
                <KV label="Open requests">{PART_REQUESTS.filter(r => r.partNo === openPart.partNo && r.status !== "Delivered").length}</KV>
                <KV label="Returns">{PART_RETURNS.filter(r => r.partNo === openPart.partNo).length}</KV>
              </DrawerSection>
              <Link href="/integrations" className="inline-flex items-center gap-1.5 text-button-sm text-blue-600 hover:underline"><Warehouse size={14} /> Stock history and purchasing in EVOQ Inventory <ArrowSquareOut size={12} /></Link>
            </>
          );
        })()}
      </SideDrawer>

      {/* ── Request parts ── */}
      <SideDrawer open={reqOpen} onClose={() => setReqOpen(false)} icon={HandArrowDown} title="Request parts" subtitle="Reserve stock for a job or a technician's van"
        footer={<DrawerActions onCancel={() => setReqOpen(false)} onSubmit={submitReq} submitLabel="Raise request" disabled={!req.partNo} />}>
        <DrawerSection title="Part">
          <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_120px] gap-3">
            <Autocomplete options={PARTS.map(p => p.partNo)} value={req.partNo || null} onChange={(_, v) => setReq(q => ({ ...q, partNo: v ?? "" }))}
              getOptionLabel={o => { const p = partNo(o); return p ? `${p.name} · ${p.partNo}` : o; }}
              renderInput={pr => <TextField {...pr} label="Part *" size="small" sx={FX} />} />
            <TextField label="Quantity" type="number" value={req.qty} onChange={e => setReq(q => ({ ...q, qty: Math.max(1, Number(e.target.value) || 1) }))} size="small" sx={FX} />
          </div>
          {req.partNo && (() => { const p = partNo(req.partNo)!; return <p className="m-0 mt-2 text-caption text-[var(--text-muted)]">{available(p)} available in the warehouse · {techStockTotal(p)} in vans</p>; })()}
        </DrawerSection>
        <DrawerSection title="For">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormControl size="small" fullWidth sx={FX}>
              <InputLabel>Technician</InputLabel>
              <Select label="Technician" value={req.technician} onChange={e => setReq(q => ({ ...q, technician: e.target.value, jobId: "" }))}>
                {TECHNICIANS.map(t => <MenuItem key={t} value={t} sx={{ fontSize: "0.84rem" }}>{t}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl size="small" fullWidth sx={FX}>
              <InputLabel>Job (optional)</InputLabel>
              <Select label="Job (optional)" value={req.jobId} onChange={e => setReq(q => ({ ...q, jobId: e.target.value as number | "" }))}>
                <MenuItem value="" sx={{ fontSize: "0.84rem" }}><em>Van restock</em></MenuItem>
                {ALL_JOBS.filter(j => j.technician === req.technician && !["Completed", "Cancelled"].includes(j.status)).slice(0, 12).map(j => (
                  <MenuItem key={j.id} value={j.id} sx={{ fontSize: "0.84rem" }}>{j.jobId} · {j.customer} · {j.scheduledDate}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </div>
        </DrawerSection>
      </SideDrawer>

      {toastNode}
    </PageShell>
  );
}
