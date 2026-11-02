"use client";
import { useSyncExternalStore } from "react";
import { ALL_JOBS, WORKSPACE_STORE, type JobWorkspace } from "@/lib/jobsData";
import { applyEntity, entityId } from "@/lib/workspaceData";

/**
 * When the office reassigns or cancels a job a technician has open, the technician must be told, and anything they had not yet
 * saved must not vanish. This file notices the change (a light check against the server, or a refused/conflicting save),
 * puts the saved copy of the job in place, keeps a copy of the unsaved work on the device, and tells the screens.
 * WorkspaceProvider only calls the three functions marked "called by WorkspaceProvider".
 */

export type JobIssue = { jobId: number; jobRef: string; kind: "reassigned" | "cancelled" | "removed"; to?: string; unsaved: boolean; at: number };
type Saved = Map<string, { version: number; json: string }>;

const ISSUES_KEY = "serviceops.jobIssues";
const STASH_KEY = (id: number | string) => `serviceops.unsavedJob.${id}`;
const issues = new Map<number, JobIssue>();
const subs = new Set<() => void>();
let version = 0;
let loaded = false;
let getSaved: (() => Saved) | null = null;

const bump = () => { version++; subs.forEach(f => f()); };
const load = () => {
  if (loaded || typeof localStorage === "undefined") return;
  loaded = true;
  try { for (const i of JSON.parse(localStorage.getItem(ISSUES_KEY) ?? "[]") as JobIssue[]) issues.set(i.jobId, i); } catch { /* unreadable: start empty */ }
};
const persist = () => { try { localStorage.setItem(ISSUES_KEY, JSON.stringify([...issues.values()])); } catch { /* storage unavailable */ } };

/** The notices to show on the technician screens. Re-renders when one is added or dismissed. */
export function useJobIssues(): JobIssue[] {
  useSyncExternalStore(f => { subs.add(f); return () => { subs.delete(f); }; }, () => version, () => 0);
  load();
  return [...issues.values()];
}
export function dismissJobIssue(jobId: number) { issues.delete(jobId); persist(); bump(); }

/** Does the job workspace hold anything a person typed, ticked or photographed? */
export const hasWork = (ws: JobWorkspace | undefined) =>
  !!ws && (ws.notes.length > 0 || ws.photos.some(p => p.src) || !!ws.checks?.some(Boolean) || ws.extraParts.length > 0 || !!ws.signature || !!ws.signOff || !!ws.workStartedAt || !!ws.outcome);

/** Keeps a copy of the unsaved work on this device. Photos are dropped if the browser has no room for them. */
function stash(jobId: number | string, ws: unknown) {
  try { localStorage.setItem(STASH_KEY(jobId), JSON.stringify(ws)); }
  catch { try { localStorage.setItem(STASH_KEY(jobId), JSON.stringify({ ...(ws as object), photos: [] })); } catch { /* no room at all */ } }
}
export const readStash = (jobId: number): JobWorkspace | null => { try { const s = localStorage.getItem(STASH_KEY(jobId)); return s ? JSON.parse(s) : null; } catch { return null; } };
export const hasStash = (jobId: number) => { try { return localStorage.getItem(STASH_KEY(jobId)) !== null; } catch { return false; } };

/** Called by WorkspaceProvider: lets this file read the versions the provider last saw. */
export function setSyncHost(saved: () => Saved) { getSaved = saved; }

/** Called by WorkspaceProvider before a conflicting record is replaced by the server copy: keep our unsaved version of a job workspace. Returns true when something was kept. */
export function keepUnsavedWork(kind: string, key: string, saved: Saved): boolean {
  if (kind !== "workspaces") return false;
  const local = WORKSPACE_STORE[Number(key)];
  const prev = saved.get(entityId(kind, key));
  if (!local || !hasWork(local) || (prev && prev.json === JSON.stringify(local))) return false;
  stash(key, local);
  return true;
}

/**
 * Compares this technician's jobs with the server and handles any that were reassigned, cancelled or removed.
 * Called by WorkspaceProvider after a save was refused or conflicted, and on a timer on the technician screens.
 */
export async function reconcileMyJobs(me: string): Promise<JobIssue[]> {
  load();
  const saved = getSaved?.();
  if (!me || !saved || typeof navigator === "undefined" || !navigator.onLine) return [];
  const res = await fetch("/api/tech/jobs").catch(() => null);
  if (!res?.ok) return [];
  const data: { jobs: [string, number, string][] } = await res.json().catch(() => ({ jobs: [] }));
  if (!data.jobs.length) return []; // an empty answer is not proof that jobs were removed
  const server = new Map(data.jobs.map(([k, v, json]) => [k, { version: v, json }]));
  const found: JobIssue[] = [];

  for (const local of [...ALL_JOBS]) {
    if (local.technician !== me || issues.get(local.id)?.at) continue;
    const row = server.get(String(local.id));
    let kind: JobIssue["kind"] | null = null, to: string | undefined;
    if (!row) kind = "removed";
    else {
      const s = JSON.parse(row.json) as { technician: string; status: string };
      if (s.technician !== me) { kind = "reassigned"; to = s.technician; }
      else if (s.status === "Cancelled" && local.status !== "Cancelled") kind = "cancelled";
    }
    if (!kind) continue;

    const key = String(local.id);
    const wsLocal = WORKSPACE_STORE[local.id];
    const wsSaved = saved.get(entityId("workspaces", key));
    const unsaved = hasStash(local.id) || (hasWork(wsLocal) && (!wsSaved || wsSaved.json !== JSON.stringify(wsLocal)));
    if (unsaved && wsLocal && !hasStash(local.id)) stash(key, wsLocal);

    // Put the saved copies in place, and tell the provider they are saved, so the next save does not try to send them back.
    if (row) { applyEntity("jobs", key, row.json); saved.set(entityId("jobs", key), { version: row.version, json: row.json }); }
    else { applyEntity("jobs", key, null); saved.delete(entityId("jobs", key)); }
    const w = await fetch(`/api/tech/jobs?workspace=${key}`).then(r => (r.ok ? r.json() : null)).catch(() => null);
    const wsRow: [string, number, string] | null | undefined = w?.workspace;
    if (wsRow) { applyEntity("workspaces", key, wsRow[2]); saved.set(entityId("workspaces", key), { version: wsRow[1], json: wsRow[2] }); }
    else { applyEntity("workspaces", key, null); saved.delete(entityId("workspaces", key)); }

    const issue: JobIssue = { jobId: local.id, jobRef: local.jobId, kind, to, unsaved, at: Date.now() };
    issues.set(local.id, issue);
    found.push(issue);
  }
  if (found.length) { persist(); bump(); }
  return found;
}

export const issueText = (i: JobIssue) =>
  i.kind === "reassigned" ? `${i.jobRef} was reassigned to ${i.to ?? "another technician"}.` : i.kind === "cancelled" ? `${i.jobRef} was cancelled by the office.` : `${i.jobRef} was removed by the office.`;
