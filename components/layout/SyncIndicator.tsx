"use client";
import { useSyncState } from "@/lib/syncState";

/** Compact connection/sync status. Reusable anywhere (app header, technician screen). */
export function syncLabel(s: { online: boolean; syncing: boolean; pending: number; error: string | null }) {
  const n = `${s.pending} change${s.pending === 1 ? "" : "s"}`;
  if (!s.online) return s.pending ? `Offline · ${n} waiting` : "Offline";
  if (s.syncing) return "Syncing…";
  if (s.error && s.pending) return `Sync failed · ${n} waiting`;
  if (s.pending) return `Online · ${n} waiting`;
  return "Online · synced";
}

export default function SyncIndicator({ className = "" }: { className?: string }) {
  const s = useSyncState();
  const label = syncLabel(s);
  const tone = !s.online ? "#B45309" : s.error && s.pending ? "#DC2626" : s.syncing || s.pending ? "#F59E0B" : "#16A34A";
  const title = s.lastSyncedAt ? `${label}. Last synced ${new Date(s.lastSyncedAt).toLocaleTimeString()}` : label;
  return (
    <span role="status" aria-live="polite" aria-label={`Sync status: ${title}`} title={title} data-testid="sync-indicator"
      className={`inline-flex items-center gap-1.5 flex-shrink-0 rounded-full border border-[var(--serviceops-soft)] px-2 py-1 text-[11px] font-semibold leading-none text-[var(--serviceops-depth)] whitespace-nowrap ${className}`}>
      <span aria-hidden="true" className={s.syncing ? "animate-pulse" : ""} style={{ width: 8, height: 8, borderRadius: 999, background: tone, display: "inline-block" }} />
      <span className={s.pending || !s.online || s.syncing || s.error ? "" : "hidden sm:inline"}>{label}</span>
    </span>
  );
}
