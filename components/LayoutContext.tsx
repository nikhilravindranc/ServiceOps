"use client";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

/**
 * Screen layout: how pages, menus and tables are arranged. Colours are not affected.
 * - classic: the original roomy layout.
 * - compact: a tighter, flatter layout with a full-height sidebar whose groups collapse.
 * More layouts can be added here later. The choice is saved on this device.
 */
export type Layout = "classic" | "compact";
export const LAYOUTS: { key: Layout; label: string; hint: string }[] = [
  { key: "classic", label: "Classic", hint: "Roomy cards, large headings and a wide banner on Home." },
  { key: "compact", label: "Compact", hint: "Tighter and flatter: more on screen, collapsible menu groups, a slim banner and a table-first Home." },
];

const KEY = "ui-layout";
const Ctx = createContext<{ layout: Layout; setLayout: (l: Layout) => void }>({ layout: "classic", setLayout: () => {} });

export function LayoutProvider({ children }: { children: ReactNode }) {
  const [layout, setState] = useState<Layout>("classic");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try { const saved = localStorage.getItem(KEY); if (saved === "compact" || saved === "classic") setState(saved); } catch { /* storage unavailable */ }
    setReady(true);
  }, []);
  // Only after the saved choice has been read, so the first render cannot overwrite what the boot script set.
  useEffect(() => { if (ready) document.documentElement.dataset.layout = layout; }, [layout, ready]);

  const setLayout = useCallback((l: Layout) => {
    setState(l);
    try { localStorage.setItem(KEY, l); } catch { /* ignore */ }
    // The header sets the sidebar width; tell it to recalculate for the new layout.
    window.dispatchEvent(new CustomEvent("layout-change", { detail: l }));
  }, []);

  return <Ctx.Provider value={{ layout, setLayout }}>{children}</Ctx.Provider>;
}

export const useLayout = () => useContext(Ctx);
