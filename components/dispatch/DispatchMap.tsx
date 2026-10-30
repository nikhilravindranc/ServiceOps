"use client";
import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import Button from "@mui/material/Button";
import { Path, Lightning } from "@phosphor-icons/react";
import { jobWindow, fmtTime, JOB_DURATION_HRS, type WorkOrder } from "@/lib/serviceData";
import type { JobRecord } from "@/lib/jobsData";
import { DEPOT, placeFor } from "@/lib/geoData";
import { planRoute, routeKm, routeDriveMin, type Stop, type RoutePlan } from "@/lib/routing";

const PALETTE = ["#2563EB", "#16A34A", "#DC2626", "#9333EA", "#EA580C", "#0891B2", "#CA8A04", "#DB2777"];

type Props = {
  jobs: JobRecord[];
  queue: WorkOrder[];
  selId: { kind: string; id?: number } | null;
  zoneOk: (z: string) => boolean;
  isDark: boolean;
  onSelect: (s: { kind: "wo" | "job"; id: number }) => void;
  onApply: (tech: string, times: { id: number; start: number }[]) => void;
};

/**
 * Live map of the day: every visit numbered in the order a technician does them, one coloured route per technician
 * with distance and drive time, unscheduled work as dashed markers, and a route suggestion per technician.
 * Tiles come from OpenStreetMap, which needs no key. Set NEXT_PUBLIC_MAPBOX_TOKEN to use Mapbox tiles instead.
 */
export default function DispatchMap({ jobs, queue, selId, zoneOk, isDark, onSelect, onApply }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const fitted = useRef(false);

  // Per-technician stops for the day, in current visiting order.
  const routes = useMemo(() => {
    const by = new Map<string, Stop[]>();
    for (const j of jobs) {
      if (j.status === "Cancelled" || !zoneOk(j.region)) continue;
      const p = placeFor(j.customer, j.region);
      const w = jobWindow(j);
      const list = by.get(j.technician) ?? [];
      list.push({ id: j.id, label: `${j.jobId} · ${j.customer}`, lat: p.lat, lng: p.lng, start: w.start, durMs: w.end - w.start || JOB_DURATION_HRS[j.serviceType] * 3600000, status: j.status });
      by.set(j.technician, list);
    }
    return [...by].map(([tech, stops], i) => {
      const order = stops.sort((a, b) => a.start - b.start);
      return { tech, color: PALETTE[i % PALETTE.length], order, km: routeKm(order), min: routeDriveMin(order), plan: planRoute(order) as RoutePlan | null };
    }).sort((a, b) => a.tech.localeCompare(b.tech));
  }, [jobs, zoneOk]);

  useEffect(() => {
    if (!el.current || map.current) return;
    const m = L.map(el.current, { scrollWheelZoom: true }).setView([DEPOT.lat, DEPOT.lng], 10);
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    L.tileLayer(token ? `https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/256/{z}/{x}/{y}@2x?access_token=${token}` : "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      { maxZoom: 18, attribution: token ? "© Mapbox © OpenStreetMap" : "© OpenStreetMap contributors" }).addTo(m);
    layer.current = L.layerGroup().addTo(m);
    map.current = m;
    setTimeout(() => m.invalidateSize(), 50);
    return () => { m.remove(); map.current = null; layer.current = null; fitted.current = false; };
  }, []);

  useEffect(() => {
    const m = map.current, g = layer.current;
    if (!m || !g) return;
    g.clearLayers();
    const pts: L.LatLngTuple[] = [[DEPOT.lat, DEPOT.lng]];

    L.marker([DEPOT.lat, DEPOT.lng], { icon: L.divIcon({ className: "", html: `<div style="width:22px;height:22px;border-radius:6px;background:#111;color:#fff;font:700 11px sans-serif;display:flex;align-items:center;justify-content:center;border:2px solid #fff">D</div>`, iconSize: [22, 22] }) }).bindTooltip("Depot").addTo(g);

    for (const r of routes) {
      const line: L.LatLngTuple[] = [[DEPOT.lat, DEPOT.lng], ...r.order.map(s => [s.lat, s.lng] as L.LatLngTuple)];
      L.polyline(line, { color: r.color, weight: 3, opacity: 0.75, dashArray: "6 6" }).bindTooltip(`${r.tech}: ${r.km.toFixed(1)} km, about ${r.min} min driving`, { sticky: true }).addTo(g);
      r.order.forEach((s, i) => {
        pts.push([s.lat, s.lng]);
        const active = selId?.kind === "job" && (selId as { id?: number }).id === s.id;
        const job = jobs.find(j => j.id === s.id);
        L.marker([s.lat, s.lng], { icon: L.divIcon({ className: "", iconSize: [28, 28], html: `<div style="width:${active ? 32 : 26}px;height:${active ? 32 : 26}px;border-radius:50%;background:${r.color};color:#fff;font:700 12px sans-serif;display:flex;align-items:center;justify-content:center;border:3px solid ${active ? "#F59E0B" : "#fff"};box-shadow:0 1px 4px rgba(0,0,0,.4)">${i + 1}</div>` }) })
          .bindTooltip(`${i + 1}. ${s.label}<br>${r.tech} · ${fmtTime(s.start)}${job ? ` · ${job.status}` : ""}`)
          .on("click", () => onSelect({ kind: "job", id: s.id })).addTo(g);
      });
    }

    for (const w of queue) {
      if (!zoneOk(w.zone)) continue;
      const p = placeFor(w.customer, w.zone);
      pts.push([p.lat, p.lng]);
      const active = selId?.kind === "wo" && (selId as { id?: number }).id === w.id;
      L.marker([p.lat, p.lng], { icon: L.divIcon({ className: "", iconSize: [24, 24], html: `<div style="width:${active ? 28 : 22}px;height:${active ? 28 : 22}px;border-radius:50%;background:#fff;border:3px dashed #F59E0B;box-shadow:0 1px 4px rgba(0,0,0,.3)"></div>` }) })
        .bindTooltip(`${w.number} · ${w.title}<br>Not yet scheduled`).on("click", () => onSelect({ kind: "wo", id: w.id })).addTo(g);
    }

    if (!fitted.current && pts.length > 1) { m.fitBounds(L.latLngBounds(pts), { padding: [30, 30], maxZoom: 12 }); fitted.current = true; }
  }, [routes, queue, selId, zoneOk, jobs, onSelect]);

  // Dark mode: invert the tile layer only, so markers keep their colours.
  useEffect(() => {
    const pane = map.current?.getPane("tilePane");
    if (pane) pane.style.filter = isDark ? "invert(1) hue-rotate(180deg) brightness(0.9) contrast(0.9)" : "";
  }, [isDark]);

  const plans = routes.filter(r => r.plan);

  return (
    <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-3 p-3">
      <div ref={el} className="flex-1 min-h-[360px] rounded-xl overflow-hidden border border-[var(--border-soft)]" role="region" aria-label="Map of today's visits" />
      <div className="lg:w-[300px] flex-shrink-0 overflow-auto flex flex-col gap-3 text-[13px]">
        <div>
          <p className="m-0 mb-2 text-caption font-semibold uppercase tracking-wide text-[var(--text-muted)]">Routes</p>
          {routes.length === 0 ? <p className="m-0 text-[var(--text-muted)]">No visits on this day.</p> : (
            <ul className="m-0 p-0 list-none flex flex-col gap-1.5">
              {routes.map(r => (
                <li key={r.tech} className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: r.color }} />
                  <span className="flex-1 truncate text-[var(--text-primary)]">{r.tech}</span>
                  <span className="text-[var(--text-muted)] whitespace-nowrap">{r.order.length} stop{r.order.length === 1 ? "" : "s"} · {r.km.toFixed(0)} km · {r.min} min</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <p className="m-0 mb-2 inline-flex items-center gap-1.5 text-caption font-semibold uppercase tracking-wide text-[var(--text-muted)]"><Lightning size={13} weight="fill" />Optimise the day</p>
          {plans.length === 0 ? <p className="m-0 text-[var(--text-muted)]">No change would save meaningful driving. A suggestion appears when a technician has three or more visits that have not started and a shorter order exists.</p> : (
            <ul className="m-0 p-0 list-none flex flex-col gap-2.5">
              {plans.map(r => (
                <li key={r.tech} className="rounded-xl border border-[var(--border)] p-3">
                  <p className="m-0 font-semibold text-[var(--text-primary)]">{r.tech}</p>
                  <p className="m-0 mt-0.5 text-[var(--text-body)]">{r.plan!.reason}</p>
                  <p className="m-0 mt-1 text-[12px] text-[var(--text-muted)]">New order: {r.plan!.order.map((s, i) => `${i + 1}. ${s.label.split(" · ")[1]} ${fmtTime(r.plan!.times[i].start)}`).join(", ")}</p>
                  <Button size="small" variant="outlined" startIcon={<Path size={14} />} sx={{ mt: 1 }} onClick={() => onApply(r.tech, r.plan!.times)}>Apply new order</Button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <p className="m-0 text-[12px] text-[var(--text-muted)]">Positions are sample locations inside each zone; distances are road estimates at 35 km/h. Customers are not notified automatically when you apply a new order.</p>
      </div>
    </div>
  );
}

