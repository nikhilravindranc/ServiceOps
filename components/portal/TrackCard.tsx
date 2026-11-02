"use client";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const TrackMap = dynamic(() => import("@/components/portal/TrackMap"), { ssr: false, loading: () => <div className="h-[220px] rounded-xl bg-[#F5F5F5]" /> });

type Track = { available: true; technician: string; km: number; etaMin: number; updatedAt: string; tech: { lat: number; lng: number }; destination: { lat: number; lng: number; approximate: boolean } };
const POLL_MS = 15_000;

function ago(iso: string, now: number) {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  return s < 60 ? `${Math.max(5, Math.round(s / 5) * 5)} s ago` : `${Math.round(s / 60)} min ago`;
}

/** "On the way" card for one visit. Polls every 15 seconds and renders nothing while tracking is unavailable. */
export default function TrackCard({ job }: { job: number }) {
  const [t, setT] = useState<Track | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch(`/api/portal/track?job=${job}`, { cache: "no-store" });
        const d = r.ok ? await r.json() : null;
        if (alive) setT(d?.available ? d : null);
      } catch { if (alive) setT(null); }
    };
    load();
    const poll = setInterval(load, POLL_MS), tick = setInterval(() => setNow(Date.now()), 5_000);
    return () => { alive = false; clearInterval(poll); clearInterval(tick); };
  }, [job]);

  if (!t) return null;
  return (
    <div className="rounded-xl border border-[#BFDBFE] bg-[#EFF6FF] p-3 mb-3" data-testid="track-card">
      <p className="m-0 text-[15px] font-extrabold text-[#1D4ED8]">{t.technician} is on the way</p>
      <p className="m-0 mt-1 text-[13px] text-[#1E3A8A]"><b>About {t.etaMin} min</b> · {t.km.toFixed(1)} km away · updated {ago(t.updatedAt, now)}</p>
      <div className="mt-2"><TrackMap tech={t.tech} dest={t.destination} /></div>
      {t.destination.approximate && <p className="m-0 mt-1 text-[11.5px] text-[#6B6B6B]">Your location on the map is approximate until your address is confirmed.</p>}
    </div>
  );
}
