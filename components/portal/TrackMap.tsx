"use client";
import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

type P = { lat: number; lng: number };
const dot = (bg: string, label: string) => L.divIcon({ className: "", iconSize: [26, 26], html: `<div style="width:26px;height:26px;border-radius:50%;background:${bg};color:#fff;font:700 12px sans-serif;display:flex;align-items:center;justify-content:center;border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)">${label}</div>` });

/** Small OpenStreetMap view (same approach as the Dispatch map) with the technician and the destination. */
export default function TrackMap({ tech, dest }: { tech: P; dest: P }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const fitted = useRef(false);

  useEffect(() => {
    if (!el.current || map.current) return;
    const m = L.map(el.current, { scrollWheelZoom: false }).setView([dest.lat, dest.lng], 12);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18, attribution: "© OpenStreetMap contributors" }).addTo(m);
    layer.current = L.layerGroup().addTo(m);
    map.current = m;
    setTimeout(() => m.invalidateSize(), 50);
    return () => { m.remove(); map.current = null; layer.current = null; fitted.current = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const m = map.current, g = layer.current;
    if (!m || !g) return;
    g.clearLayers();
    L.marker([dest.lat, dest.lng], { icon: dot("#111", "H") }).bindTooltip("Your visit").addTo(g);
    L.marker([tech.lat, tech.lng], { icon: dot("#2563EB", "T") }).bindTooltip("Technician").addTo(g);
    if (!fitted.current) { m.fitBounds(L.latLngBounds([[tech.lat, tech.lng], [dest.lat, dest.lng]]), { padding: [30, 30], maxZoom: 14 }); fitted.current = true; }
  }, [tech.lat, tech.lng, dest.lat, dest.lng]);

  return <div ref={el} className="h-[220px] w-full rounded-xl overflow-hidden border border-[#EEE]" role="region" aria-label="Map showing the technician and your address" />;
}
