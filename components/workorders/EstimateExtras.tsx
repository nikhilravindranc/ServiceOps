"use client";
import { useEffect, useState } from "react";
import Button from "@mui/material/Button";
import { PaperPlaneTilt, Trash, Copy, ArrowsClockwise, SealCheck } from "@phosphor-icons/react";
import { fmtDate, money, setEstimateStatus, logWO, estimateTotal, type Estimate, type WorkOrder, type PriceLine } from "@/lib/serviceData";

type CatalogItem = { id: string; name: string; price: number; active: boolean };
const TAX = 18;
const sum = (lines: PriceLine[]) => lines.reduce((s, l) => s + l.qty * l.rate, 0);
const field = "h-9 px-3 rounded-[10px] text-[13px] border-[1.5px] border-[var(--serviceops-soft)] bg-[var(--bg-card)] text-[var(--text-primary)] outline-none focus:border-[var(--serviceops-primary)]";

/** Good/better/best options, deposit, customer approval link and follow-up for an estimate. */
export default function EstimateExtras({ estimate, wo, email, refresh, notify }: {
  estimate: Estimate; wo: WorkOrder; email?: string; refresh: () => void; notify: (msg: string) => void;
}) {
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const editable = estimate.status === "Draft" || estimate.status === "Sent";
  const options = estimate.options;

  useEffect(() => {
    if (options) fetch("/api/catalog").then(r => (r.ok ? r.json() : [])).then((c: CatalogItem[]) => setCatalog(c.filter(i => i.active))).catch(() => {});
  }, [!!options]); // eslint-disable-line react-hooks/exhaustive-deps

  /** The lines that count toward the total follow the middle option until the customer chooses. */
  const syncLines = () => { if (estimate.options && !estimate.chosenOption) estimate.lines = (estimate.options[1] ?? estimate.options[0]).lines.map(l => ({ ...l })); };
  const change = (fn: () => void) => { fn(); syncLines(); refresh(); };

  const makeOptions = () => change(() => {
    estimate.options = [{ key: "good", label: "Good" }, { key: "better", label: "Better" }, { key: "best", label: "Best" }].map(o => ({ ...o, lines: estimate.lines.map(l => ({ ...l })) }));
  });
  const addLine = (key: string, itemId: string) => {
    const item = catalog.find(c => c.id === itemId);
    if (!item) return;
    change(() => estimate.options!.find(o => o.key === key)!.lines.push({ item: item.name, qty: 1, rate: item.price }));
  };

  const sendLink = async () => {
    setBusy(true);
    const res = await fetch("/api/public-links", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "estimate", ref: estimate.number, customer: estimate.customer, title: wo.title, email: email ?? "", taxPct: TAX, lines: estimate.lines, options: estimate.options, depositPct: estimate.depositPct }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { notify(data.error ?? "Could not create the link"); return; }
    setLink(data.url);
    const reminder = estimate.status === "Sent";
    if (reminder) estimate.followUps = (estimate.followUps ?? 0) + 1;
    else { setEstimateStatus(estimate, "Sent"); estimate.sentAt = Date.now(); }
    logWO(wo, reminder ? `Estimate ${estimate.number} reminder sent` : `Estimate ${estimate.number} sent to the customer`);
    refresh();
    notify(data.emailed ? `Estimate emailed to ${email}` : "Link created. Email is not configured here, so share the link below.");
  };

  const total = estimateTotal(estimate);
  const deposit = estimate.depositPct ? Math.round(total * estimate.depositPct / 100) : 0;

  return (
    <div className="flex flex-col gap-4">
      {estimate.approval && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-[13px] font-medium text-emerald-800 bg-emerald-50 border border-emerald-200">
          <SealCheck size={18} weight="fill" /> Approved by {estimate.approval.name} through the {estimate.approval.via} on {fmtDate(estimate.approval.at)}
          {estimate.chosenOption && estimate.options && <> · {estimate.options.find(o => o.key === estimate.chosenOption)?.label} option</>}{estimate.depositPaid ? <> · deposit {money(estimate.depositPaid)} paid (test mode)</> : null}
        </div>
      )}

      {editable && (
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-body text-[var(--text-muted)]" htmlFor="deposit">Deposit on approval</label>
          <input id="deposit" type="number" min={0} max={100} className={`${field} w-[84px]`} value={estimate.depositPct ?? 0}
            onChange={e => change(() => { estimate.depositPct = Math.min(100, Math.max(0, Number(e.target.value) || 0)); })} />
          <span className="text-body text-[var(--text-muted)]">% {deposit > 0 && `= ${money(deposit)} of ${money(total)}`}</span>
        </div>
      )}

      {editable && !options && <div><Button size="small" variant="outlined" onClick={makeOptions}>Offer good / better / best options</Button></div>}

      {options && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {options.map(o => (
            <div key={o.key} className="rounded-xl border border-[var(--border-soft)] p-3 flex flex-col gap-2" style={estimate.chosenOption === o.key ? { borderColor: "#10B981", background: "rgba(16,185,129,0.06)" } : undefined}>
              <div className="flex justify-between items-baseline"><b className="text-label">{o.label}</b><b>{money(sum(o.lines) * (1 + TAX / 100))}</b></div>
              <ul className="m-0 p-0 list-none text-[12.5px] flex flex-col gap-1">
                {o.lines.map((l, i) => (
                  <li key={i} className="flex justify-between gap-2"><span className="truncate">{l.qty} × {l.item}</span>
                    <span className="flex items-center gap-1.5">{money(l.qty * l.rate)}
                      {editable && <button type="button" aria-label={`Remove ${l.item}`} onClick={() => change(() => o.lines.splice(i, 1))} className="text-[var(--text-muted)] hover:text-red-500"><Trash size={13} /></button>}</span></li>
                ))}
              </ul>
              {editable && (
                <select aria-label={`Add catalog item to ${o.label}`} className={field} value="" onChange={e => addLine(o.key, e.target.value)}>
                  <option value="">+ Add from catalog</option>{catalog.map(c => <option key={c.id} value={c.id}>{c.name} · {money(c.price)}</option>)}
                </select>
              )}
            </div>
          ))}
          {editable && <div className="lg:col-span-3"><button type="button" className="text-[13px] font-semibold text-red-600" onClick={() => change(() => { estimate.options = undefined; })}>Remove options</button></div>}
        </div>
      )}

      {editable && (
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="contained" disabled={busy} startIcon={estimate.status === "Sent" ? <ArrowsClockwise size={14} /> : <PaperPlaneTilt size={14} />} onClick={sendLink}>
            {estimate.status === "Sent" ? "Send reminder" : "Send to customer"}
          </Button>
          {!email && <span className="text-caption text-[var(--text-muted)]">No contact email on file. A link will be created to share by hand.</span>}
          {(estimate.followUps ?? 0) > 0 && <span className="text-caption text-[var(--text-muted)]">{estimate.followUps} reminder{estimate.followUps === 1 ? "" : "s"} sent</span>}
        </div>
      )}
      {link && (
        <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
          <input readOnly aria-label="Customer approval link" className={`${field} flex-1 min-w-[240px]`} value={link} onFocus={e => e.currentTarget.select()} />
          <Button size="small" variant="outlined" startIcon={<Copy size={13} />} onClick={() => navigator.clipboard?.writeText(link).then(() => notify("Link copied"))}>Copy</Button>
          <a href={link} target="_blank" rel="noreferrer" className="font-semibold text-blue-600">Preview as customer</a>
        </div>
      )}
    </div>
  );
}
