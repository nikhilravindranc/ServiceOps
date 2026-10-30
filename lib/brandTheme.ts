/**
 * Colour themes for the whole company, chosen in Settings > Appearance.
 * A theme only changes colours (never layout, wording or behaviour). Dark mode keeps its own palette.
 * Ported from the EVOQ Healthcare Platform theme module and mapped to the --serviceops-* variables.
 */

// ── Colour helpers (run in the browser; nothing is uploaded) ─────────────────────────────
export type RGB = [number, number, number];
export const hexToRgb = (hex: string): RGB => {
  const h = hex.replace("#", "");
  const v = h.length === 3 ? h.split("").map(c => c + c).join("") : h.padEnd(6, "0");
  return [parseInt(v.slice(0, 2), 16) || 0, parseInt(v.slice(2, 4), 16) || 0, parseInt(v.slice(4, 6), 16) || 0];
};
export const rgbToHex = ([r, g, b]: RGB) => "#" + [r, g, b].map(x => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, "0")).join("");
/** Blends a toward b. t = 0 is all a, t = 1 is all b. */
export const mix = (a: string, b: string, t: number) => { const x = hexToRgb(a), y = hexToRgb(b); return rgbToHex([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]); };
const lin = (c: number) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
const luminance = (hex: string) => { const [r, g, b] = hexToRgb(hex); return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b); };
export const contrast = (a: string, b: string) => { const la = luminance(a), lb = luminance(b); return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05); };
/** Darkens a colour until white text on it reads clearly (at least 4.5 to 1). */
export const readableOnWhite = (hex: string) => { let c = hex, i = 0; while (contrast(c, "#ffffff") < 4.5 && i++ < 30) c = mix(c, "#000000", 0.06); return c; };
/** Dark or white text, whichever reads better on this colour. */
export const textOn = (hex: string) => (contrast(hex, "#111111") >= contrast(hex, "#ffffff") ? "#111111" : "#ffffff");
export const rgba = (hex: string, a: number) => { const [r, g, b] = hexToRgb(hex); return `rgba(${r}, ${g}, ${b}, ${a})`; };

// ── Themes ──────────────────────────────────────────────────────────────────────────────
/** What a theme sets in light mode. */
export interface BrandColors {
  /** Text, links, focus rings and icons on white. Must be readable on white. */
  primary: string;
  /** Fill for buttons and badges. */
  action: string;
  hover: string;
  /** Soft surface: sidebar, active items, table heads. */
  tint: string;
}

export interface BrandTheme { id: string; name: string; audience: string; description: string; colors: BrandColors | null }

/** Builds a full set from one brand colour. */
export function fromPrimary(base: string): BrandColors {
  const action = base;
  return { primary: readableOnWhite(base), action, hover: mix(action, "#000000", 0.14), tint: mix(base, "#ffffff", 0.92) };
}

export const BRAND_THEMES: BrandTheme[] = [
  { id: "serviceops", name: "ServiceOps Amber", audience: "Default", description: "The original amber and neutral grey.", colors: null },
  { id: "clinic", name: "Clinic Blue", audience: "Healthcare and clinics", description: "Calm clinical blues.", colors: { primary: "#2563A8", action: "#2563A8", hover: "#1D4F88", tint: "#EEF4FB" } },
  { id: "teal", name: "Fresh Teal", audience: "Cleaning and facilities", description: "Clean teal, bright and reassuring.", colors: { primary: "#0E7C80", action: "#0E7C80", hover: "#0A6366", tint: "#EBF6F5" } },
  { id: "rose", name: "Rose Quartz", audience: "Beauty and personal care", description: "Soft rose with a refined feel.", colors: { primary: "#A23B64", action: "#A23B64", hover: "#832F50", tint: "#FBF0F5" } },
  { id: "sage", name: "Soft Sage", audience: "Landscaping and outdoors", description: "Natural greens, gentle on the eyes.", colors: { primary: "#3B7A58", action: "#3B7A58", hover: "#2E6146", tint: "#EEF6F1" } },
  { id: "coral", name: "Active Coral", audience: "Repairs and trades", description: "Warm, energetic coral.", colors: { primary: "#B24A1A", action: "#B24A1A", hover: "#913B14", tint: "#FDF1EA" } },
  { id: "lavender", name: "Calm Lavender", audience: "Wellness and home services", description: "Restful lavender.", colors: { primary: "#6A4DAE", action: "#6A4DAE", hover: "#563D8F", tint: "#F3EFFB" } },
  { id: "indigo", name: "Slate Indigo", audience: "Professional services", description: "Composed indigo that suits any trade.", colors: { primary: "#3B4CB0", action: "#3B4CB0", hover: "#2F3C8F", tint: "#EFF1FB" } },
];

/** A company's own theme, built from one brand colour (optionally taken from its logo). */
export interface CustomBrand { primary: string }
export const DEFAULT_CUSTOM: CustomBrand = { primary: "#2563A8" };

/** What is saved for the company. */
export interface BrandSetting { theme: string; custom: CustomBrand | null }
export const DEFAULT_BRAND: BrandSetting = { theme: "serviceops", custom: null };

export const isHex = (s: unknown): s is string => typeof s === "string" && /^#[0-9a-fA-F]{6}$/.test(s);

/** Parses saved JSON defensively; anything unexpected falls back to the default. */
export function parseBrand(raw: unknown): BrandSetting {
  try {
    const o = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!o || typeof o !== "object") return DEFAULT_BRAND;
    const { theme, custom } = o as { theme?: unknown; custom?: { primary?: unknown } | null };
    if (theme === "custom" && custom && isHex(custom.primary)) return { theme: "custom", custom: { primary: custom.primary } };
    if (typeof theme === "string" && BRAND_THEMES.some(t => t.id === theme)) return { theme, custom: null };
  } catch { /* fall through */ }
  return DEFAULT_BRAND;
}

/** The colours in effect, or null for the original amber. */
export function brandColors(b: BrandSetting): BrandColors | null {
  if (b.theme === "custom" && b.custom) return fromPrimary(b.custom.primary);
  return BRAND_THEMES.find(t => t.id === b.theme)?.colors ?? null;
}

/** CSS that recolours the app in light mode. Dark mode is untouched. Empty for the default theme. */
export function brandCss(b: BrandSetting): string {
  const c = brandColors(b);
  if (!c) return "";
  return `html:not(.dark){--serviceops-primary:${c.primary};--serviceops-action:${c.action};--serviceops-hover:${c.hover};--serviceops-tint:${c.tint};--bg-sidebar:${c.tint};--serviceops-primary-10:${rgba(c.action, 0.1)};--theme-on-action:${textOn(c.action)};}`;
}

const STYLE_ID = "brand-theme";
export const BRAND_CACHE_KEY = "brand-css";

/** Puts the theme on the page. */
export function applyBrand(b: BrandSetting) {
  if (typeof document === "undefined") return;
  const css = brandCss(b);
  let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!css) { el?.remove(); } else {
    if (!el) { el = document.createElement("style"); el.id = STYLE_ID; document.head.appendChild(el); }
    el.textContent = css;
  }
  try { if (css) localStorage.setItem(BRAND_CACHE_KEY, css); else localStorage.removeItem(BRAND_CACHE_KEY); } catch { /* storage unavailable */ }
}

/** Runs before the first paint so the page does not flash amber first. The server value replaces it once loaded. */
export const BRAND_BOOT_SCRIPT = `try{var c=localStorage.getItem("${BRAND_CACHE_KEY}");if(c){var s=document.createElement("style");s.id="${STYLE_ID}";s.textContent=c;document.head.appendChild(s)}}catch(e){}`;

// ── Logo: read a file and find its brand colours ────────────────────────────────────────
/** Most common colour in an image that is not white, black or grey. */
export function dominantColor(data: Uint8ClampedArray): string | null {
  const buckets = new Map<number, { n: number; r: number; g: number; b: number }>();
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
    if (a < 128) continue;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    if (mn > 232 || mx < 28 || mx - mn < 26) continue;
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const e = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    e.n++; e.r += r; e.g += g; e.b += b; buckets.set(key, e);
  }
  const top = [...buckets.values()].sort((x, y) => y.n - x.n)[0];
  return top ? rgbToHex([top.r / top.n, top.g / top.n, top.b / top.n]) : null;
}

/** Reads a logo image in the browser and returns its main brand colour (null if it has none). */
export async function colorFromLogo(file: File): Promise<string | null> {
  if (!file.type.startsWith("image/")) throw new Error("Choose an image file (PNG, JPG, SVG or WebP).");
  if (file.size > 3 * 1024 * 1024) throw new Error("That image is larger than 3 MB. Choose a smaller one.");
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("That image could not be read.")); i.src = url; });
    const k = Math.min(1, 80 / Math.max(img.width || 80, img.height || 80));
    const w = Math.max(1, Math.round((img.width || 80) * k)), h = Math.max(1, Math.round((img.height || 80) * k));
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    const ctx = c.getContext("2d")!; ctx.drawImage(img, 0, 0, w, h);
    return dominantColor(ctx.getImageData(0, 0, w, h).data);
  } finally { URL.revokeObjectURL(url); }
}
