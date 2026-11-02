"use client";
import { useEffect } from "react";

/** Registers the service worker in production builds, or in development when the address has ?sw=1 (so dev HMR is untouched). */
export default function SwRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const wanted = process.env.NODE_ENV === "production" || new URLSearchParams(window.location.search).get("sw") === "1";
    if (!wanted) return;
    let cancelled = false;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).then(reg => {
      if (cancelled) return;
      // A new version installs in the background and takes over on the next full load (no skipWaiting mid-session, so the
      // page never runs with chunks from two builds). If no page is controlled yet, it can take over straight away.
      const activateIfIdle = (w: ServiceWorker | null) => { if (w && !navigator.serviceWorker.controller) w.postMessage({ type: "SKIP_WAITING" }); };
      activateIfIdle(reg.waiting);
      reg.addEventListener("updatefound", () => {
        const w = reg.installing;
        w?.addEventListener("statechange", () => { if (w.state === "installed") activateIfIdle(w); });
      });
      const check = () => { reg.update().catch(() => {}); };
      document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") check(); });
    }).catch(() => { /* no offline support, the app still works online */ });
    return () => { cancelled = true; };
  }, []);
  return null;
}

/** Tells the service worker who is signed in (so another user never sees cached data), or clears everything on sign-out. */
export async function clearOfflineCaches() {
  try {
    if ("caches" in window) for (const n of await caches.keys()) if (n.startsWith("serviceops-pages-") || n.startsWith("serviceops-data-")) await caches.delete(n);
    navigator.serviceWorker?.controller?.postMessage({ type: "CLEAR_CACHES" });
  } catch { /* ignore */ }
}
export function tellServiceWorkerUser(userId: string) {
  try { navigator.serviceWorker?.controller?.postMessage({ type: "SET_USER", userId }); } catch { /* ignore */ }
}
