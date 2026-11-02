"use client";
import { useEffect, useRef, useState } from "react";

/** Draw-to-sign pad that works with finger, stylus and mouse. Calls onChange with a small PNG data URL, or null when cleared. */
export default function SignaturePad({ onChange, disabled = false }: { onChange: (dataUrl: string | null) => void; disabled?: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [empty, setEmpty] = useState(true);

  useEffect(() => {
    const c = canvas.current!;
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    c.width = c.clientWidth * ratio; c.height = c.clientHeight * ratio;
    const ctx = c.getContext("2d")!;
    ctx.scale(ratio, ratio); ctx.lineWidth = 2.2; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = "#111";
  }, []);

  const point = (e: React.PointerEvent) => { const r = canvas.current!.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const down = (e: React.PointerEvent) => {
    if (disabled) return;
    try { canvas.current!.setPointerCapture(e.pointerId); } catch { /* some browsers refuse capture; drawing still works */ }
    drawing.current = true;
    const ctx = canvas.current!.getContext("2d")!; const p = point(e);
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + 0.01, p.y + 0.01); ctx.stroke();
  };
  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    const ctx = canvas.current!.getContext("2d")!; const p = point(e);
    ctx.lineTo(p.x, p.y); ctx.stroke();
  };
  const up = () => {
    if (!drawing.current) return;
    drawing.current = false; setEmpty(false);
    onChange(canvas.current!.toDataURL("image/png"));
  };
  const clear = () => {
    const c = canvas.current!; c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    setEmpty(true); onChange(null);
  };

  return (
    <div>
      <canvas ref={canvas} aria-label="Signature area" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
        className="w-full h-40 rounded-xl border-2 border-dashed border-[var(--border)] bg-white touch-none" style={{ touchAction: "none" }} />
      <div className="flex items-center justify-between mt-1.5">
        <span className="text-caption text-[var(--text-muted)]">{empty ? "Sign above with a finger or stylus" : "Signature captured"}</span>
        <button type="button" onClick={clear} disabled={empty || disabled} className="text-caption font-semibold text-blue-600 disabled:text-[var(--text-muted)]">Clear</button>
      </div>
    </div>
  );
}
