"use client";
import { useSyncExternalStore } from "react";

export type SyncState = { online: boolean; syncing: boolean; pending: number; lastSyncedAt: number | null; error: string | null };

// The server snapshot assumes online so server and first client render agree; WorkspaceProvider corrects it on mount.
let state: SyncState = { online: true, syncing: false, pending: 0, lastSyncedAt: null, error: null };
const listeners = new Set<() => void>();

export const getSyncState = () => state;
export function setSyncState(patch: Partial<SyncState>) {
  const next = { ...state, ...patch };
  if ((Object.keys(next) as (keyof SyncState)[]).every(k => next[k] === state[k])) return;
  state = next;
  listeners.forEach(l => l());
}
export function subscribeSync(cb: () => void) { listeners.add(cb); return () => { listeners.delete(cb); }; }
export const useSyncState = () => useSyncExternalStore(subscribeSync, getSyncState, getSyncState);
