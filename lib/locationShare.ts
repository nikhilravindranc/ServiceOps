/** Client side of live location sharing: watch the device position and upload it at most every UPLOAD_MS. */
export const UPLOAD_MS = 15_000;
const KEY = "serviceops.locationShare.optIn";

export const readOptIn = () => { try { return localStorage.getItem(KEY) === "1"; } catch { return false; } };
export const saveOptIn = (on: boolean) => { try { on ? localStorage.setItem(KEY, "1") : localStorage.removeItem(KEY); } catch { /* storage unavailable */ } };

export type ShareHandlers = {
  /** Called with the job id to attach at the moment of each upload. */
  getJobId?: () => number | undefined;
  onSent?: (at: number) => void;
  /** A reason sharing has to stop (permission denied, company switch off, outside working hours, unsupported). */
  onFatal: (message: string) => void;
};

/** Starts sharing; returns a function that stops the watch (it does not delete stored positions: call stopSharing for that). */
export function startSharing(h: ShareHandlers): () => void {
  if (typeof navigator === "undefined" || !navigator.geolocation) { h.onFatal("This device cannot share its location."); return () => {}; }
  let last = 0, stopped = false, sending = false;
  const fatal = (m: string) => { if (stopped) return; stopped = true; navigator.geolocation.clearWatch(id); h.onFatal(m); };
  const id = navigator.geolocation.watchPosition(async pos => {
    const now = Date.now();
    if (stopped || sending || now - last < UPLOAD_MS) return;
    sending = true; last = now;
    try {
      const r = await fetch("/api/location", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: Number.isFinite(pos.coords.accuracy) ? pos.coords.accuracy : undefined, jobId: h.getJobId?.(), optIn: true }),
      });
      if (r.ok) h.onSent?.(Date.now());
      else if (r.status === 403 || r.status === 401) fatal((await r.json().catch(() => ({}))).error ?? "Sharing is not allowed right now.");
    } catch { /* offline: the next update tries again */ }
    finally { sending = false; }
  }, err => {
    fatal(err.code === err.PERMISSION_DENIED ? "Location permission was denied. Allow location access for this site, then turn sharing on again." : "Could not get your position. Sharing is off.");
  }, { enableHighAccuracy: true, maximumAge: 10_000, timeout: 30_000 });
  return () => { if (!stopped) { stopped = true; navigator.geolocation.clearWatch(id); } };
}

/** Removes this technician's stored positions. keepalive lets it finish while the page closes. */
export function stopSharing() {
  return fetch("/api/location", { method: "DELETE", keepalive: true }).catch(() => undefined);
}
