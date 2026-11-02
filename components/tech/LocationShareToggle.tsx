"use client";
import { useEffect, useRef, useState } from "react";
import { readOptIn, saveOptIn, startSharing, stopSharing } from "@/lib/locationShare";

/**
 * Opt-in live location sharing for a technician. `active` (default true) turns sharing off while false, for example
 * when the job is finished. The choice is remembered on this device; sharing also stops on unmount and on any refusal.
 */
export default function LocationShareToggle({ jobId, active = true }: { jobId?: number; active?: boolean }) {
  const [optIn, setOptIn] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState("");
  const jobRef = useRef(jobId);
  jobRef.current = jobId;

  useEffect(() => { setOptIn(readOptIn()); }, []);

  useEffect(() => {
    if (!optIn || !active) { setSharing(false); return; }
    setError(""); setSharing(true);
    const stop = startSharing({
      getJobId: () => jobRef.current,
      onFatal: msg => { setError(msg); setSharing(false); setOptIn(false); saveOptIn(false); void stopSharing(); },
    });
    return () => { stop(); setSharing(false); void stopSharing(); };
  }, [optIn, active]);

  const toggle = (on: boolean) => { setOptIn(on); saveOptIn(on); setError(""); };

  return (
    <section className="rounded-xl border border-[var(--border)] p-3 text-[13px]" aria-label="Location sharing">
      <label className="flex items-start gap-3 cursor-pointer">
        <input type="checkbox" role="switch" className="mt-1 h-4 w-4" checked={optIn} onChange={e => toggle(e.target.checked)} aria-describedby="loc-consent" />
        <span>
          <span className="block font-semibold text-[var(--text-primary)]">Share my location</span>
          <span id="loc-consent" className="block mt-0.5 text-[var(--text-muted)]">Your position is shared with dispatch and, while you are on the way, with the customer you are travelling to. It stops when you turn it off, finish the job or leave working hours.</span>
        </span>
      </label>
      {sharing && (
        <p className="m-0 mt-2 inline-flex items-center gap-2 font-semibold text-emerald-700" role="status" data-testid="sharing-indicator">
          <span className="relative flex h-2.5 w-2.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" /><span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-600" /></span>
          Sharing location
        </p>
      )}
      {optIn && !active && !error && <p className="m-0 mt-2 text-[var(--text-muted)]">Sharing is paused because this job is not under way.</p>}
      {error && <p className="m-0 mt-2 font-medium text-red-700" role="alert">{error}</p>}
    </section>
  );
}
