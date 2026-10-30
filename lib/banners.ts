/**
 * Home banner choices. Presets are plain CSS (no image files), so they always load. "photo" is the original
 * photograph; "custom" is an image the administrator uploads; "none" shows no banner at all.
 */
export type BannerPreset = { key: string; label: string; css: string; size?: string; darkText: boolean };

export const PHOTO_URL =
  "https://plus.unsplash.com/premium_photo-1667511116296-365dfbb3aadc?q=80&w=1600&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D";

export const BANNER_PRESETS: BannerPreset[] = [
  { key: "dawn", label: "Dawn", css: "linear-gradient(120deg,#FDE68A 0%,#FDBA74 48%,#FCA5A5 100%)", darkText: true },
  { key: "sky", label: "Sky", css: "radial-gradient(circle at 82% 18%,rgba(255,255,255,.75),transparent 42%),linear-gradient(120deg,#BFDBFE,#93C5FD 60%,#A5B4FC)", darkText: true },
  { key: "meadow", label: "Meadow", css: "radial-gradient(circle at 12% 95%,rgba(255,255,255,.55),transparent 46%),linear-gradient(120deg,#BBF7D0,#86EFAC 55%,#6EE7B7)", darkText: true },
  { key: "dusk", label: "Dusk", css: "linear-gradient(120deg,#FBCFE8,#C4B5FD 55%,#A5B4FC)", darkText: true },
  { key: "slate", label: "Slate", css: "linear-gradient(120deg,#1F2937,#374151 60%,#4B5563)", darkText: false },
  {
    key: "blueprint", label: "Blueprint", darkText: false, size: "32px 32px, 32px 32px, 100% 100%",
    css: "linear-gradient(rgba(255,255,255,.13) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.13) 1px,transparent 1px),linear-gradient(120deg,#1E3A8A,#1D4ED8)",
  },
];

export const bannerPreset = (key: string) => BANNER_PRESETS.find(p => p.key === key);
