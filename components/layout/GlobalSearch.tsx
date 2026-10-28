"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import InputBase from "@mui/material/InputBase";
import Popper from "@mui/material/Popper";
import ClickAwayListener from "@mui/material/ClickAwayListener";
import Dialog from "@mui/material/Dialog";
import IconButton from "@mui/material/IconButton";
import {
  MagnifyingGlass, Command, ClipboardText, Wrench, Buildings, Cube, Package, X,
} from "@phosphor-icons/react";
import { searchAll, type SearchHit } from "@/lib/serviceData";

const KIND_ICON: Record<SearchHit["kind"], typeof Wrench> = {
  "Work order": ClipboardText, Job: Wrench, Customer: Buildings, Asset: Cube, Part: Package,
};

function Results({ hits, active, onPick, query }: { hits: SearchHit[]; active: number; onPick: (h: SearchHit) => void; query: string }) {
  if (query.trim().length < 2) {
    return <p className="m-0 px-4 py-6 text-caption text-[var(--text-muted)] text-center">Type a work order, job, customer, asset, serial or part number</p>;
  }
  if (!hits.length) return <p className="m-0 px-4 py-6 text-body text-[var(--text-muted)] text-center">No matches for “{query}”</p>;
  let lastKind = "";
  return (
    <ul className="m-0 p-1.5 list-none">
      {hits.map((h, i) => {
        const Icon = KIND_ICON[h.kind];
        const header = h.kind !== lastKind;
        lastKind = h.kind;
        return (
          <li key={`${h.kind}-${h.href}`}>
            {header && <p className="m-0 px-2.5 pt-2 pb-1 text-nav-group-label uppercase text-[var(--text-muted)]">{h.kind}s</p>}
            <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => onPick(h)}
              className={`w-full flex items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors ${i === active ? "bg-[var(--serviceops-tint)]" : "hover:bg-[var(--serviceops-tint)]"}`}>
              <Icon size={16} weight="duotone" className="flex-shrink-0 text-[var(--text-muted)]" />
              <span className="min-w-0 flex-1">
                <span className="block text-body text-[var(--text-primary)] truncate">{h.label}</span>
                <span className="block text-caption text-[var(--text-muted)] truncate">{h.meta}</span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function useSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const hits = useMemo(() => searchAll(q, 3), [q]);
  useEffect(() => setActive(0), [q]);
  const pick = (h: SearchHit, done?: () => void) => { setQ(""); done?.(); router.push(h.href); };
  const onKeyDown = (e: React.KeyboardEvent, done?: () => void) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive(a => Math.min(hits.length - 1, a + 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setActive(a => Math.max(0, a - 1)); }
    if (e.key === "Enter" && hits[active]) pick(hits[active], done);
    if (e.key === "Escape") { setQ(""); done?.(); }
  };
  return { q, setQ, hits, active, pick, onKeyDown };
}

/** Header search (desktop) — ⌘K / Ctrl+K focuses it. */
export function HeaderSearch({ isDark }: { isDark: boolean }) {
  const s = useSearch();
  const anchor = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); input.current?.focus(); setOpen(true); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <ClickAwayListener onClickAway={() => setOpen(false)}>
      <div ref={anchor} className={`flex items-center gap-2 border rounded-xl px-3 py-1.5 w-72 transition-all ${
        isDark
          ? "bg-[var(--serviceops-surface)] border-[var(--serviceops-soft)] focus-within:border-[var(--serviceops-primary)]"
          : "bg-slate-50 border-[var(--serviceops-soft)] focus-within:border-[var(--serviceops-primary)]"
      }`}>
        <MagnifyingGlass size={15} color={isDark ? "#71717A" : "#9A9A9A"} weight="duotone" />
        <InputBase
          inputRef={input}
          placeholder="Search work orders, jobs, customers…"
          value={s.q}
          onFocus={() => setOpen(true)}
          onChange={e => { s.setQ(e.target.value); setOpen(true); }}
          onKeyDown={e => s.onKeyDown(e, () => { setOpen(false); input.current?.blur(); })}
          inputProps={{ "aria-label": "Search ServiceOps" }}
          sx={{
            flex: 1, fontSize: "0.78rem", color: isDark ? "#D4D4D8" : "#3D3D3D",
            "& input::placeholder": { color: isDark ? "#71717A" : "#9A9A9A", opacity: 1 },
          }}
        />
        <span className="inline-flex items-center gap-0.5 text-[10px] text-[var(--text-faint)]"><Command size={11} weight="duotone" />K</span>
        <Popper open={open && s.q.length > 0} anchorEl={anchor.current} placement="bottom-start" style={{ zIndex: 1300 }}>
          <div className="mt-1.5 w-[380px] max-h-[420px] overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--bg-card)] shadow-[0_12px_40px_rgba(17,17,17,0.12)]">
            <Results hits={s.hits} active={s.active} query={s.q} onPick={h => s.pick(h, () => setOpen(false))} />
          </div>
        </Popper>
      </div>
    </ClickAwayListener>
  );
}

/** Mobile — search icon that opens a full-screen search sheet. */
export function MobileSearch({ isDark }: { isDark: boolean }) {
  const s = useSearch();
  const [open, setOpen] = useState(false);
  const close = () => { setOpen(false); s.setQ(""); };
  return (
    <>
      <IconButton size="small" aria-label="Search" onClick={() => setOpen(true)} sx={{ borderRadius: "10px" }}>
        <MagnifyingGlass size={20} color={isDark ? "#9CA3AF" : "#6B6B6B"} weight="duotone" />
      </IconButton>
      <Dialog fullScreen open={open} onClose={close}>
        <div className="flex items-center gap-2 px-3 h-16 border-b border-[var(--border)]">
          <MagnifyingGlass size={18} className="text-[var(--text-muted)]" />
          <InputBase autoFocus placeholder="Search ServiceOps" value={s.q} onChange={e => s.setQ(e.target.value)}
            onKeyDown={e => s.onKeyDown(e, close)} sx={{ flex: 1, fontSize: "16px", color: "var(--text-primary)" }} />
          <IconButton aria-label="Close search" onClick={close}><X size={18} /></IconButton>
        </div>
        <div className="overflow-y-auto">
          <Results hits={s.hits} active={s.active} query={s.q} onPick={h => s.pick(h, close)} />
        </div>
      </Dialog>
    </>
  );
}
