"use client";
import { Fragment, useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { DownloadSimple, ArrowsClockwise } from "@phosphor-icons/react";

type Entry = { id: string; at: string; action: string; entity: string | null; entityId: string | null; by: string | null; role: string | null; meta: { changed?: string[]; before?: Record<string, unknown>; after?: Record<string, unknown>; note?: string; records?: number } | null };
const selectCls = "h-9 px-3 rounded-[10px] text-[13px] border-[1.5px] border-[var(--serviceops-soft)] bg-[var(--bg-card)] text-[var(--text-primary)]";
const btnCls = "inline-flex items-center gap-1.5 h-9 px-3.5 rounded-[10px] text-[13px] font-bold border-[1.5px] border-[var(--serviceops-soft)] text-[var(--text-primary)] bg-[var(--bg-card)] disabled:opacity-50";
const ACTIONS = [["", "All activity"], ["record.", "Record changes"], ["request.", "Requests"], ["location.", "Location sharing"], ["workspace.", "Workspace"], ["automation.", "Automations"]];
const label = (a: string) => a.replace("record.", "Record ").replace("request.", "Request ").replace("workspace.", "Workspace ").replace(/[._]/g, " ");
const fmt = (v: unknown) => (typeof v === "string" ? v : JSON.stringify(v));

/** Who changed what and when, with before and after values, plus a full backup download for administrators. */
export default function AuditPanel() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "Administrator";
  const [rows, setRows] = useState<Entry[] | null>(null);
  const [action, setAction] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    const res = await fetch(`/api/audit?limit=100${action ? `&action=${encodeURIComponent(action)}` : ""}`).catch(() => null);
    if (!res?.ok) { setError("Could not load the activity log."); setRows([]); return; }
    setRows(await res.json());
  }, [action]);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <select aria-label="Filter activity" className={selectCls} value={action} onChange={e => setAction(e.target.value)}>
          {ACTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <button type="button" className={btnCls} onClick={load}><ArrowsClockwise size={15} />Refresh</button>
        <span className="flex-1" />
        {isAdmin
          ? <a className={btnCls} href="/api/workspace/export" download><DownloadSimple size={15} />Download full backup</a>
          : <span className="text-caption text-[var(--text-muted)]">Backups can be downloaded by an administrator.</span>}
      </div>
      {error && <p role="alert" className="m-0 text-body text-red-600">{error}</p>}
      <div className="overflow-x-auto rounded-xl border border-[var(--border-soft)]">
        <table className="w-full text-left text-table-cell min-w-[640px]">
          <thead><tr className="bg-[var(--serviceops-tint)] text-caption uppercase tracking-wide text-[var(--text-muted)]"><th className="px-3 py-2">When</th><th className="px-3 py-2">Who</th><th className="px-3 py-2">What</th><th className="px-3 py-2">Record</th></tr></thead>
          <tbody>
            {rows === null && <tr><td colSpan={4} className="px-3 py-6 text-center text-[var(--text-muted)]">Loading…</td></tr>}
            {rows?.length === 0 && !error && <tr><td colSpan={4} className="px-3 py-6 text-center text-[var(--text-muted)]">Nothing logged yet.</td></tr>}
            {rows?.map(r => (
              <Fragment key={r.id}>
                <tr className="border-t border-[var(--border-soft)] cursor-pointer hover:bg-[var(--serviceops-tint)]" onClick={() => setOpen(open === r.id ? null : r.id)}>
                  <td className="px-3 py-2 whitespace-nowrap text-[var(--text-body)]">{new Date(r.at).toLocaleString()}</td>
                  <td className="px-3 py-2">{r.by ?? "System"}{r.role ? <span className="text-[var(--text-muted)]"> · {r.role}</span> : null}</td>
                  <td className="px-3 py-2">{label(r.action)}{r.meta?.changed?.length ? <span className="text-[var(--text-muted)]"> · {r.meta.changed.join(", ")}</span> : null}</td>
                  <td className="px-3 py-2 text-[var(--text-muted)]">{r.entity ?? ""}{r.entityId ? ` ${r.entityId}` : ""}</td>
                </tr>
                {open === r.id && (
                  <tr className="bg-[var(--serviceops-tint)]"><td colSpan={4} className="px-3 py-3">
                    {r.meta?.changed?.length ? (
                      <dl className="m-0 grid grid-cols-[140px_minmax(0,1fr)_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-caption">
                        <dt className="font-bold text-[var(--text-muted)]">Field</dt><dd className="m-0 font-bold text-[var(--text-muted)]">Before</dd><dd className="m-0 font-bold text-[var(--text-muted)]">After</dd>
                        {r.meta.changed.map(k => (<Fragment key={k}><dt className="text-[var(--text-primary)]">{k}</dt><dd className="m-0 break-words">{r.meta?.before && k in r.meta.before ? fmt(r.meta.before[k]) : "none"}</dd><dd className="m-0 break-words">{r.meta?.after && k in r.meta.after ? fmt(r.meta.after[k]) : "removed"}</dd></Fragment>))}
                      </dl>
                    ) : <p className="m-0 text-caption text-[var(--text-body)]">{r.meta?.records ? `${r.meta.records} records saved for the first time.` : r.meta?.note ?? "No further detail."}</p>}
                  </td></tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
