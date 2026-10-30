"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useSession } from "next-auth/react";
import { applyBrand, brandColors, DEFAULT_BRAND, parseBrand, type BrandColors, type BrandSetting } from "@/lib/brandTheme";

/**
 * The company's colour theme. Loaded from the organization once signed in, applied to the page as CSS
 * variables (see lib/brandTheme.ts), and read by the MUI theme so buttons and inputs follow it too.
 */
const Ctx = createContext<{ brand: BrandSetting; saved: BrandSetting; colors: BrandColors | null; preview: (b: BrandSetting | null) => void; commit: (b: BrandSetting) => Promise<boolean> }>({
  brand: DEFAULT_BRAND, saved: DEFAULT_BRAND, colors: null, preview: () => {}, commit: async () => false,
});

export function BrandProvider({ children }: { children: ReactNode }) {
  const { status } = useSession();
  const [saved, setSaved] = useState<BrandSetting>(DEFAULT_BRAND);
  const [draft, setDraft] = useState<BrandSetting | null>(null);
  const brand = draft ?? saved;

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/org").then(r => (r.ok ? r.json() : null)).then(o => { if (o) setSaved(parseBrand(o.brandTheme)); }).catch(() => {});
  }, [status]);

  useEffect(() => { if (status === "authenticated") applyBrand(brand); }, [brand, status]);

  const preview = useCallback((b: BrandSetting | null) => setDraft(b), []);
  const commit = useCallback(async (b: BrandSetting) => {
    const res = await fetch("/api/org", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ brandTheme: JSON.stringify(b) }) });
    if (!res.ok) return false;
    setSaved(b); setDraft(null);
    return true;
  }, []);

  const value = useMemo(() => ({ brand, saved, colors: brandColors(brand), preview, commit }), [brand, saved, preview, commit]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useBrand = () => useContext(Ctx);
