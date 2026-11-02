"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { applyLinkUpdates } from "@/lib/linkSync";
import { runAutomations } from "@/lib/automations";
import { applyEntity, clearWorkspace, entityMap, importEntities, importWorkspace, splitEntityId, entityId, ORDER } from "@/lib/workspaceData";
import { clearPending, loadPending, savePending, type PendingChanges } from "@/lib/offlineQueue";
import { setSyncState } from "@/lib/syncState";
import { tellServiceWorkerUser } from "@/components/SwRegister";

const NO_DATA_PAGES = ["/login", "/register", "/forgot-password", "/reset-password", "/verify-email", "/invite", "/onboarding", "/book", "/approve", "/pay", "/review", "/portal", "/dev-idp"];
const SAVE_EVERY_MS = 4000;
// Marks a record whose queued edit has not been saved yet, so it always counts as changed against the server copy.
const UNSAVED = "\u0000unsaved";

type Changes = [string, string, number, string][];
type Deletes = [string, string, number][];

/**
 * Loads the organization's saved data into the in-memory collections before any screen renders, then saves changes
 * back every few seconds. Pages keep reading the collections synchronously, so none of them had to change.
 * Changes that cannot be saved (offline, server error) are also kept in IndexedDB per user and re-applied on the next load.
 */
export default function WorkspaceProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const userId = session?.user?.id ?? "";
  const needsData = !NO_DATA_PAGES.some(p => pathname === p || pathname.startsWith(`${p}/`));
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState("");
  // For every record: the version we last saw and the JSON we last saved or loaded, so only changed records are sent.
  const state = useRef({ saved: new Map<string, { version: number; json: string }>(), canWrite: false, started: false, userId: "", persisted: "" });

  // Sent home from a screen this role may not open.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("denied") !== "1") return;
    setNotice("Your role does not have access to that page.");
    window.history.replaceState(null, "", window.location.pathname);
    const t = setTimeout(() => setNotice(""), 6000);
    return () => clearTimeout(t);
  }, []);

  // The connection indicator works on every screen, signed in or not.
  useEffect(() => {
    const update = () => setSyncState({ online: navigator.onLine });
    update();
    window.addEventListener("online", update); window.addEventListener("offline", update);
    return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update); };
  }, []);

  useEffect(() => {
    if (status === "authenticated" && userId) tellServiceWorkerUser(userId);
  }, [status, userId]);

  useEffect(() => {
    if (!needsData || status !== "authenticated" || state.current.started) return;
    state.current.started = true;
    state.current.userId = userId;

    const applyPending = (p: PendingChanges) => {
      const s = state.current;
      const changes = [...p.changes].sort((a, b) => Number(a[0] === ORDER) - Number(b[0] === ORDER)); // order entries last
      for (const [k, key, base, json] of changes) {
        applyEntity(k, key, json);
        // Saved against the version the edit was made on, so a record someone else changed meanwhile is a conflict (server wins).
        if (base > 0) s.saved.set(entityId(k, key), { version: base, json: UNSAVED }); else s.saved.delete(entityId(k, key));
      }
      for (const [k, key, base] of p.deletes) {
        applyEntity(k, key, null);
        const prev = s.saved.get(entityId(k, key));
        if (prev) s.saved.set(entityId(k, key), { version: base, json: prev.json });
      }
    };

    (async () => {
      let loaded = false;
      try {
        // The user id in the address only keys the service worker's cached copy per user; the server ignores it.
        const res = await fetch(`/api/workspace?u=${encodeURIComponent(userId)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.rows.length) {
            importEntities(data.rows.map((x: [string, string, number, string]) => [x[0], x[1], x[3]]));
            state.current.saved = new Map(data.rows.map((x: [string, string, number, string]) => [entityId(x[0], x[1]), { version: x[2], json: x[3] }]));
          } else if (data.legacyJson) importWorkspace(data.legacyJson); // saved record by record from the first save on
          else if (!data.sampleData) clearWorkspace();
          state.current.canWrite = data.canWrite;
          loaded = true;
          setSyncState({ lastSyncedAt: Date.now(), error: null });
        }
      } catch { /* offline and no cached copy: keep what is in memory, never wipe it, and do not save over the server */ }
      // Work queued on this device (offline, or a save that failed) goes back on top of the loaded data.
      if (loaded && state.current.canWrite && userId) {
        try {
          const pending = await loadPending(userId);
          if (pending) { applyPending(pending); state.current.persisted = "stored"; }
        } catch { /* unreadable queue: ignore */ }
      }
      if (!loaded) setSyncState({ error: "Could not load the workspace" });
      applyLinkUpdates().catch(() => {});
      // Follow-up rules run at most twice a day per browser.
      try {
        const last = Number(localStorage.getItem("automations-last") ?? 0);
        if (state.current.canWrite && navigator.onLine && Date.now() - last > 12 * 3600_000) { localStorage.setItem("automations-last", String(Date.now())); runAutomations().catch(() => {}); }
      } catch { /* storage unavailable: skip */ }
      setReady(true);
    })();
  }, [needsData, status, userId]);

  useEffect(() => {
    if (!ready) return;
    let saving = false;
    const uid = state.current.userId;

    const diff = () => {
      const s = state.current;
      const now = entityMap();
      const changes: Changes = [];
      const deletes: Deletes = [];
      for (const [id, json] of now) {
        const prev = s.saved.get(id);
        if (!prev || prev.json !== json) { const [k, key] = splitEntityId(id); changes.push([k, key, prev?.version ?? 0, json]); }
      }
      for (const [id, prev] of s.saved) if (!now.has(id)) { const [k, key] = splitEntityId(id); deletes.push([k, key, prev.version]); }
      return { changes, deletes };
    };
    // Keeps the durable copy in step with what is still unsaved (nothing pending removes it).
    const persist = async (changes: Changes, deletes: Deletes) => {
      if (!uid) return;
      const sig = changes.length || deletes.length ? JSON.stringify({ changes, deletes }) : "";
      if (sig === state.current.persisted) return;
      state.current.persisted = sig;
      if (sig) await savePending(uid, { changes, deletes }); else await clearPending(uid);
    };

    const save = async (keepalive = false) => {
      const s = state.current;
      if (!s.canWrite) { setSyncState({ pending: 0 }); return; }
      if (saving) return;
      const { changes, deletes } = diff();
      setSyncState({ pending: changes.length + deletes.length });
      if (!changes.length && !deletes.length) { await persist(changes, deletes); return; }
      if (!navigator.onLine) { await persist(changes, deletes); return; }
      saving = true;
      setSyncState({ syncing: true });
      let ok = true;
      try {
        // Large first saves go in slices so no request is too big.
        const slices: { changes: Changes; deletes: Deletes }[] = [];
        let cur = { changes: [] as Changes, deletes: [] as Deletes }, size = 0;
        for (const c of changes) { cur.changes.push(c); size += c[3].length; if (size > 3_000_000) { slices.push(cur); cur = { changes: [], deletes: [] }; size = 0; } }
        cur.deletes = deletes; slices.push(cur);
        for (const slice of slices) {
          const res = await fetch("/api/workspace", { method: "PUT", keepalive: keepalive && slices.length === 1, headers: { "Content-Type": "application/json" }, body: JSON.stringify(slice) }).catch(() => null);
          if (!res?.ok) { ok = false; break; }
          const out: { versions: [string, string, number][]; conflicts: [string, string, number, string | null][] } = await res.json();
          const sent = new Map(slice.changes.map(c => [entityId(c[0], c[1]), c[3]]));
          for (const [k, key, v] of out.versions) { const id = entityId(k, key); if (sent.has(id)) s.saved.set(id, { version: v, json: sent.get(id)! }); }
          for (const d of slice.deletes) if (!out.conflicts.some(c => c[0] === d[0] && c[1] === d[1])) s.saved.delete(entityId(d[0], d[1]));
          // Records someone else changed first: keep their copy, so nothing is silently overwritten.
          for (const [k, key, v, json] of out.conflicts) {
            applyEntity(k, key, json);
            if (json === null) s.saved.delete(entityId(k, key)); else s.saved.set(entityId(k, key), { version: v, json });
          }
          if (out.conflicts.length) { setNotice(`${out.conflicts.length} record${out.conflicts.length === 1 ? " was" : "s were"} changed by someone else. Their version was kept.`); setTimeout(() => setNotice(""), 6000); }
        }
      } catch { ok = false; } finally { saving = false; }
      const left = diff();
      setSyncState({ syncing: false, pending: left.changes.length + left.deletes.length, ...(ok ? { lastSyncedAt: Date.now(), error: null } : { error: "Save failed" }) });
      await persist(left.changes, left.deletes);
    };

    const timer = setInterval(() => { save(); }, SAVE_EVERY_MS);
    const links = setInterval(() => { if (state.current.canWrite && navigator.onLine) applyLinkUpdates().catch(() => {}); }, 15000);
    const flush = () => { save(true); };
    const onVisibility = () => { if (document.visibilityState === "hidden") flush(); };
    const onOnline = () => { save(); }; // connection is back: sync now instead of waiting for the next tick
    window.addEventListener("pagehide", flush);
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisibility);
    save();
    return () => {
      clearInterval(timer); clearInterval(links);
      window.removeEventListener("pagehide", flush); window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [ready]);

  if (needsData && status !== "unauthenticated" && !ready) {
    return <div className="min-h-screen flex items-center justify-center text-[13px] text-[#8A8A8A]" role="status">Loading your workspace…</div>;
  }
  return (
    <>
      {children}
      {notice && <div role="alert" className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[2000] px-4 py-2.5 rounded-xl text-[13px] font-semibold bg-[#111] text-white shadow-lg">{notice}</div>}
    </>
  );
}
