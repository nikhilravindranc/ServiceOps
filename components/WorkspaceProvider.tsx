"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { applyLinkUpdates } from "@/lib/linkSync";
import { runAutomations } from "@/lib/automations";
import { clearWorkspace, exportWorkspace, importWorkspace } from "@/lib/workspaceData";

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
  const state = useRef({ version: 0, last: "", canWrite: false, started: false });

  useEffect(() => {
    if (!needsData || status !== "authenticated" || state.current.started) return;
    state.current.started = true;
    (async () => {
      try {
        const res = await fetch("/api/workspace");
        if (res.ok) {
          const data = await res.json();
          if (data.json) importWorkspace(data.json);
          else if (!data.sampleData) clearWorkspace();
          state.current = { ...state.current, version: data.version, canWrite: data.canWrite, last: data.json ?? "" };
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
    const save = async (keepalive = false) => {
      const s = state.current;
      if (!s.canWrite) return;
      const json = exportWorkspace();
      if (json === s.last) return;
      const res = await fetch("/api/workspace", { method: "PUT", keepalive, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ json, version: s.version }) }).catch(() => null);
      if (res?.ok) { s.version = (await res.json()).version; s.last = json; }
      else if (res?.status === 409) { setNotice("Someone else changed the workspace. Reloading the latest data…"); setTimeout(() => window.location.reload(), 1500); }
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
