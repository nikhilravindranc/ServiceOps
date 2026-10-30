"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Clock, SignIn, SignOut, DownloadSimple, WarningCircle } from "@phosphor-icons/react";
import { PageShell, PageHeader, KpiRow, KpiTile, ListCard, DataTable, Pill, Stack, useToast, type Column } from "@/components/ui/ServiceOpsUI";

type Entry = { id: string; userId: string; userName: string; clockIn: string; clockOut: string | null; note: string | null; outsideIn: boolean; outsideOut: boolean };
type State = { entries: Entry[]; open: Entry | null; manager: boolean; geofence: { lat: number; lng: number; radiusM: number } | null };

const hours = (e: Entry) => ((e.clockOut ? new Date(e.clockOut).getTime() : Date.now()) - new Date(e.clockIn).getTime()) / 3_600_000;
const hm = (h: number) => `${Math.floor(h)}h ${String(Math.round((h % 1) * 60)).padStart(2, "0")}m`;
const when = (iso: string) => new Date(iso).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export default function TimesheetsPage() {
  const { toastNode, notify } = useToast();
  const [state, setState] = useState<State | null>(null);
  const [share, setShare] = useState(true);
  const [busy, setBusy] = useState(false);
  const [, tick] = useState(0);

  const load = useCallback(async () => {
    const r = await fetch("/api/time?from=" + new Date(Date.now() - 14 * 86_400_000).toISOString());
    setState(r.ok ? await r.json() : null);
  }, []);
  useEffect(() => { load(); const t = setInterval(() => tick(n => n + 1), 30_000); return () => clearInterval(t); }, [load]);

  const position = () => new Promise<{ lat: number; lng: number } | null>(resolve => {
    if (!share || !navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(p => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }), () => resolve(null), { timeout: 8000 });
  });

  const punch = async (action: "in" | "out") => {
    setBusy(true);
    const pos = await position();
    const res = await fetch("/api/time", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...(pos ?? {}) }) });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { notify(d.error ?? "Could not record the time", undefined, "info"); return; }
    notify(d.outside ? `Clocked ${action}, but outside the work area. A manager will see a flag.` : `Clocked ${action}`, undefined, d.outside ? "info" : "success");
    load();
  };

  const mine = state?.entries ?? [];
  const week = useMemo(() => {
    const start = Date.now() - 7 * 86_400_000;
    const per = new Map<string, number>();
    for (const e of mine) if (new Date(e.clockIn).getTime() >= start) per.set(e.userName, (per.get(e.userName) ?? 0) + hours(e));
    return [...per].sort((a, b) => b[1] - a[1]);
  }, [mine]);
  const total = week.reduce((s, [, h]) => s + h, 0);
  const flagged = mine.filter(e => e.outsideIn || e.outsideOut).length;

  const columns: Column<Entry>[] = [
    { key: "who", header: "Person", sortValue: e => e.userName, cell: e => <span className="text-table-cell">{e.userName}</span> },
    { key: "in", header: "Clocked in", sortValue: e => e.clockIn, cell: e => <span className="text-table-cell">{when(e.clockIn)}</span> },
    { key: "out", header: "Clocked out", cell: e => e.clockOut ? <span className="text-table-cell">{when(e.clockOut)}</span> : <Pill tone="green">On the clock</Pill> },
    { key: "h", header: "Hours", align: "right", sortValue: hours, cell: e => <span className="text-table-cell font-semibold">{hm(hours(e))}</span> },
    { key: "flag", header: "Location", cell: e => e.outsideIn || e.outsideOut ? <Pill tone="amber">Outside work area</Pill> : <span className="text-table-cell text-[var(--text-muted)]">{state?.geofence ? "Inside" : "n/a"}</span> },
  ];

  return (
    <PageShell>
      <PageHeader title="Timesheets" subtitle="Clock in and out, and see hours worked." crumbs={[{ label: "Business" }, { label: "Timesheets" }]}
        actions={state?.manager ? (
          <a href={`/api/time/export?from=${new Date(Date.now() - 14 * 86_400_000).toISOString()}`}
            className="inline-flex items-center gap-1.5 h-10 px-4 rounded-[10px] text-[13px] font-semibold border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-primary)]">
            <DownloadSimple size={16} />Payroll CSV</a>) : undefined} />

      <ListCard className="mb-4">
        <div className="p-4 flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[220px]">
            <p className="m-0 text-label font-bold text-[var(--text-primary)]">{state?.open ? `On the clock since ${when(state.open.clockIn)}` : "You are clocked out"}</p>
            <p className="m-0 text-caption text-[var(--text-muted)]">{state?.open ? `${hm(hours(state.open))} so far` : "Clock in when you start work."}</p>
          </div>
          <label className="flex items-center gap-2 text-[13px] text-[var(--text-body)]">
            <input type="checkbox" checked={share} onChange={e => setShare(e.target.checked)} />
            Share my location when I clock in or out{state?.geofence ? " (checked against the work area)" : ""}
          </label>
          {state?.open
            ? <button type="button" disabled={busy} onClick={() => punch("out")} className="inline-flex items-center gap-1.5 h-10 px-5 rounded-[10px] text-[14px] font-bold text-white bg-slate-800 disabled:opacity-60"><SignOut size={16} />Clock out</button>
            : <button type="button" disabled={busy} onClick={() => punch("in")} className="inline-flex items-center gap-1.5 h-10 px-5 rounded-[10px] text-[14px] font-bold text-[#3B1F00] bg-[var(--serviceops-primary)] disabled:opacity-60"><SignIn size={16} />Clock in</button>}
        </div>
      </ListCard>

      <KpiRow cols="xl:grid-cols-3">
        <KpiTile label="Hours, last 7 days" value={hm(total)} tone="blue" icon={Clock} />
        <KpiTile label="People with time" value={week.length} tone="gray" icon={SignIn} />
        <KpiTile label="Outside work area" value={flagged} tone={flagged ? "amber" : "green"} icon={WarningCircle} />
      </KpiRow>

      <ListCard>
        <DataTable columns={columns} rows={mine} pageSize={10} noun="entries" rowKey={e => e.id} minWidth={720}
          empty={{ icon: Clock, title: state ? "No time recorded yet" : "Loading…", hint: "Clock in to start a timesheet" }}
          mobileCard={e => <div className="flex justify-between gap-3"><Stack top={e.userName} bottom={when(e.clockIn)} /><b>{hm(hours(e))}</b></div>} />
      </ListCard>
      {toastNode}
    </PageShell>
  );
}
