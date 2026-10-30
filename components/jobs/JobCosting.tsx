"use client";
import { useCallback, useEffect, useState } from "react";
import { Plus, Trash, Books, TrendUp } from "@phosphor-icons/react";
import { DetailCard, EmptyState, Pill, MiniTable } from "@/components/ui/ServiceOpsUI";
import { money } from "@/lib/serviceData";

type Entry = { id: string; kind: "labour" | "part" | "overhead" | "other"; label: string; qty: number; unitCost: number };
type Part = { item: string; qty: number; rate: number };
const KINDS: Entry["kind"][] = ["labour", "part", "overhead", "other"];
const input = "w-full h-9 px-3 rounded-[10px] text-[13px] border-[1.5px] border-[var(--serviceops-soft)] bg-[var(--bg-card)] text-[var(--text-primary)] outline-none focus:border-[var(--serviceops-primary)]";

/** Costs booked against a job and the margin they leave. Revenue is the job's pre-tax charge from the Services tab. */
export default function JobCosting({ jobId, revenue, parts }: { jobId: number; revenue: number; parts: Part[] }) {
  const [rows, setRows] = useState<Entry[] | null>(null);
  const [denied, setDenied] = useState(false);
  const [kind, setKind] = useState<Entry["kind"]>("labour");
  const [label, setLabel] = useState("");
  const [qty, setQty] = useState("1");
  const [unit, setUnit] = useState("");
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(`/api/job-costs?jobId=${jobId}`);
    if (res.status === 403) { setDenied(true); return; }
    setRows(res.ok ? await res.json() : []);
  }, [jobId]);
  useEffect(() => { setRows(null); load(); }, [load]);

  const post = async (body: object) => {
    const res = await fetch("/api/job-costs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) { setMsg((await res.json().catch(() => ({}))).error ?? "Could not save."); return false; }
    setMsg(""); await load(); return true;
  };

  const add = async () => {
    const q = Number(qty), u = Number(unit);
    if (label.trim().length < 2 || !(q > 0) || unit === "" || !(u >= 0)) { setMsg("Enter a description, a quantity and a unit cost."); return; }
    if (await post({ jobId, kind, label: label.trim(), qty: q, unitCost: u })) { setLabel(""); setQty("1"); setUnit(""); }
  };

  const fromCatalog = async () => {
    const res = await fetch("/api/catalog");
    if (!res.ok) { setMsg("Could not read the catalog."); return; }
    const catalog: { name: string; cost: number }[] = await res.json();
    const have = new Set((rows ?? []).filter(r => r.kind === "part").map(r => r.label));
    const found = parts.filter(p => !have.has(p.item)).flatMap(p => {
      const c = catalog.find(x => x.name === p.item);
      return c ? [{ jobId, kind: "part", label: p.item, qty: p.qty, unitCost: c.cost }] : [];
    });
    if (!found.length) { setMsg("No matching catalog costs to add. Parts already added are skipped."); return; }
    await post(found);
  };

  const remove = async (id: string) => { await fetch(`/api/job-costs/${id}`, { method: "DELETE" }); await load(); };

  if (denied) return <DetailCard icon={TrendUp} title="Job costing"><p className="m-0 text-body text-[var(--text-muted)]">Costing is visible to administrators and service managers.</p></DetailCard>;

  const cost = (rows ?? []).reduce((s, r) => s + r.qty * r.unitCost, 0);
  const profit = revenue - cost;
  const marginPct = revenue > 0 ? Math.round((profit / revenue) * 100) : 0;
  const tone = !rows?.length ? "gray" : marginPct >= 30 ? "green" : marginPct >= 10 ? "amber" : "red";
  const byKind = KINDS.map(k => ({ k, total: (rows ?? []).filter(r => r.kind === k).reduce((s, r) => s + r.qty * r.unitCost, 0) }));

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,360px)] gap-4 items-start">
      <DetailCard icon={TrendUp} title="Costs">
        {rows?.length ? (
          <MiniTable head={["Type", "Description", { label: "Qty", right: true }, { label: "Unit cost", right: true }, { label: "Total", right: true }, ""]} minWidth={560}>
            {rows.map(r => (
              <tr key={r.id} className="border-b border-[var(--border-soft)] last:border-b-0">
                <td className="px-3 py-2.5 text-table-cell capitalize">{r.kind}</td>
                <td className="px-3 py-2.5 text-table-cell">{r.label}</td>
                <td className="px-3 py-2.5 text-table-cell text-right">{r.qty}</td>
                <td className="px-3 py-2.5 text-table-cell text-right">{money(r.unitCost)}</td>
                <td className="px-3 py-2.5 text-table-cell text-right font-semibold">{money(r.qty * r.unitCost)}</td>
                <td className="px-3 py-2.5 text-right"><button type="button" aria-label={`Remove ${r.label}`} onClick={() => remove(r.id)} className="p-1 rounded-md text-[var(--text-muted)] hover:text-red-500"><Trash size={15} /></button></td>
              </tr>
            ))}
          </MiniTable>
        ) : <EmptyState icon={TrendUp} text={rows === null ? "Loading costs…" : "No costs booked yet. Add labour, parts and overhead to see this job's margin."} />}

        <div className="mt-4 pt-4 border-t border-[var(--border-soft)] grid grid-cols-2 md:grid-cols-[120px_1fr_80px_110px_auto] gap-2 items-center">
          <select aria-label="Cost type" className={input} value={kind} onChange={e => setKind(e.target.value as Entry["kind"])}>{KINDS.map(k => <option key={k} value={k}>{k}</option>)}</select>
          <input aria-label="Description" className={`${input} col-span-2 md:col-span-1`} placeholder="Description" value={label} onChange={e => setLabel(e.target.value)} />
          <input aria-label="Quantity" className={input} type="number" min="0" step="any" value={qty} onChange={e => setQty(e.target.value)} />
          <input aria-label="Unit cost" className={input} type="number" min="0" step="any" placeholder="Unit cost" value={unit} onChange={e => setUnit(e.target.value)} />
          <button type="button" onClick={add} className="h-9 px-3 rounded-[10px] text-[13px] font-bold text-[#3B1F00] bg-[var(--serviceops-primary)] hover:bg-[var(--serviceops-hover)] inline-flex items-center justify-center gap-1"><Plus size={14} weight="bold" />Add</button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button type="button" onClick={fromCatalog} className="text-[13px] font-semibold text-blue-600 inline-flex items-center gap-1.5"><Books size={15} />Add part costs from catalog</button>
          {msg && <span className="text-[12.5px] text-red-600">{msg}</span>}
        </div>
      </DetailCard>

      <DetailCard icon={TrendUp} title="Margin">
        <div className="space-y-2.5 text-body">
          <div className="flex justify-between"><span className="text-[var(--text-muted)]">Revenue (before tax)</span><b>{money(revenue)}</b></div>
          {byKind.filter(b => b.total > 0).map(b => (
            <div key={b.k} className="flex justify-between"><span className="text-[var(--text-muted)] capitalize">{b.k} cost</span><span>{money(b.total)}</span></div>
          ))}
          <div className="flex justify-between border-t border-[var(--border-soft)] pt-2.5"><span className="text-[var(--text-muted)]">Total cost</span><b>{money(cost)}</b></div>
          <div className="flex justify-between"><span className="text-[var(--text-muted)]">Profit</span><b className={profit < 0 ? "text-red-500" : ""}>{money(profit)}</b></div>
          <div className="flex justify-between items-center"><span className="text-[var(--text-muted)]">Margin</span><Pill tone={tone} dot={false}>{rows?.length ? `${marginPct}%` : "No costs yet"}</Pill></div>
        </div>
      </DetailCard>
    </div>
  );
}
