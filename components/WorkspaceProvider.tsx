"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { applyLinkUpdates } from "@/lib/linkSync";
import { runAutomations } from "@/lib/automations";
import { applyEntity, clearWorkspace, entityMap, importEntities, importWorkspace, splitEntityId, entityId } from "@/lib/workspaceData";

const NO_DATA_PAGES = ["/login", "/register", "/forgot-password", "/reset-password", "/verify-email", "/invite", "/onboarding", "/book", "/approve", "/pay", "/review", "/portal", "/dev-idp"];
const SAVE_EVERY_MS = 4000;

/**
 * Loads the organization's saved data into the in-memory collections before any screen renders, then saves changes
 * back every few seconds. Pages keep reading the collections synchronously, so none of them had to change.
 */
export default function WorkspaceProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { status } = useSession();
  const needsData = !NO_DATA_PAGES.some(p => pathname === p || pathname.startsWith(`${p}/`));
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState("");
  // For every record: the version we last saw and the JSON we last saved or loaded, so only changed records are sent.
  const state = useRef({ saved: new Map<string, { version: number; json: string }>(), canWrite: false, started: false });

  // Sent home from a screen this role may not open.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("denied") !== "1") return;
    setNotice("Your role does not have access to that page.");
    window.history.replaceState(null, "", window.location.pathname);
    const t = setTimeout(() => setNotice(""), 6000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!needsData || status !== "authenticated" || state.current.started) return;
    state.current.started = true;
    (async () => {
      try {
        const res = await fetch("/api/workspace");
        if (res.ok) {
          const data = await res.json();
          if (data.rows.length) {
            importEntities(data.rows.map((x: [string, string, number, string]) => [x[0], x[1], x[3]]));
            state.current.saved = new Map(data.rows.map((x: [string, string, number, string]) => [entityId(x[0], x[1]), { version: x[2], json: x[3] }]));
          } else if (data.legacyJson) importWorkspace(data.legacyJson); // saved record by record from the first save on
          else if (!data.sampleData) clearWorkspace();
          state.current.canWrite = data.canWrite;
        }
      } catch { /* start with the built-in data; saving will retry */ }
      applyLinkUpdates().catch(() => {});
      // Follow-up rules run at most twice a day per browser.
      try {
        const last = Number(localStorage.getItem("automations-last") ?? 0);
        if (state.current.canWrite && Date.now() - last > 12 * 3600_000) { localStorage.setItem("automations-last", String(Date.now())); runAutomations().catch(() => {}); }
      } catch { /* storage unavailable: skip */ }
      setReady(true);
    })();
  }, [needsData, status]);

  useEffect(() => {
    if (!ready) return;
    let saving = false;
    const save = async (keepalive = false) => {
      const s = state.current;
      if (!s.canWrite || saving) return;
      const now = entityMap();
      const changes: [string, string, number, string][] = [];
      const deletes: [string, string, number][] = [];
      for (const [id, json] of now) {
        const prev = s.saved.get(id);
        if (!prev || prev.json !== json) { const [k, key] = splitEntityId(id); changes.push([k, key, prev?.version ?? 0, json]); }
      }
      for (const [id, prev] of s.saved) if (!now.has(id)) { const [k, key] = splitEntityId(id); deletes.push([k, key, prev.version]); }
      if (!changes.length && !deletes.length) return;
      saving = true;
      try {
        // Large first saves go in slices so no request is too big.
        const slices: { changes: typeof changes; deletes: typeof deletes }[] = [];
        let cur = { changes: [] as typeof changes, deletes: [] as typeof deletes }, size = 0;
        for (const c of changes) { cur.changes.push(c); size += c[3].length; if (size > 3_000_000) { slices.push(cur); cur = { changes: [], deletes: [] }; size = 0; } }
        cur.deletes = deletes; slices.push(cur);
        for (const slice of slices) {
          const res = await fetch("/api/workspace", { method: "PUT", keepalive: keepalive && slices.length === 1, headers: { "Content-Type": "application/json" }, body: JSON.stringify(slice) }).catch(() => null);
          if (!res?.ok) return;
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
      } finally { saving = false; }
    };
    const timer = setInterval(() => { save(); }, SAVE_EVERY_MS);
    const links = setInterval(() => { if (state.current.canWrite) applyLinkUpdates().catch(() => {}); }, 15000);
    const flush = () => { save(true); };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flush(); });
    return () => { clearInterval(timer); clearInterval(links); window.removeEventListener("pagehide", flush); };
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
