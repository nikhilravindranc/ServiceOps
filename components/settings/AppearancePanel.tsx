"use client";
import { useEffect, useRef, useState } from "react";
import { Check, UploadSimple, ProhibitInset } from "@phosphor-icons/react";
import { BANNER_PRESETS, PHOTO_URL } from "@/lib/banners";
import HomeBanner from "@/components/dashboard/HomeBanner";
import BrandThemePanel from "@/components/settings/BrandThemePanel";
import { useLayout, LAYOUTS, type Layout } from "@/components/LayoutContext";

type Notify = (msg: string, href?: string, severity?: "success" | "info") => void;
const MAX_BYTES = 900_000;

/** Reads an image file, scales it to a 1600 by 400 banner (cropping to fill) and returns a compact JPEG data URL. */
async function toBanner(file: File): Promise<string> {
  const bmp = await createImageBitmap(file);
  const W = 1600, H = 400;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const scale = Math.max(W / bmp.width, H / bmp.height);
  const w = bmp.width * scale, h = bmp.height * scale;
  ctx.drawImage(bmp, (W - w) / 2, (H - h) / 2, w, h);
  for (const q of [0.85, 0.75, 0.65, 0.5]) {
    const url = canvas.toDataURL("image/jpeg", q);
    if (url.length < MAX_BYTES) return url;
  }
  throw new Error("That image is too detailed to use as a banner. Try a smaller or simpler one.");
}

/** A tiny drawing of each layout, so the choice can be seen before it is made. */
function LayoutSketch({ kind }: { kind: Layout }) {
  const bar = "rounded-[2px] bg-[var(--border)]";
  const accent = "rounded-[2px] bg-[var(--serviceops-primary)]";
  if (kind === "classic") {
    return (
      <div className="h-[110px] rounded-lg border border-[var(--border-soft)] bg-[var(--bg-page)] overflow-hidden flex flex-col">
        <div className="h-4 bg-[var(--bg-card)] border-b border-[var(--border-soft)] flex items-center gap-1 px-1.5"><div className={`w-6 h-1.5 ${accent}`} /></div>
        <div className="flex flex-1 min-h-0">
          <div className="w-[26%] bg-[var(--bg-card)] border-r border-[var(--border-soft)] p-1.5 flex flex-col gap-1.5"><div className={`h-1.5 w-full ${bar}`} /><div className={`h-1.5 w-4/5 ${bar}`} /><div className={`h-1.5 w-full ${bar}`} /></div>
          <div className="flex-1 p-1.5 flex flex-col gap-1.5"><div className="h-6 rounded-md bg-[var(--serviceops-tint)]" /><div className="flex gap-1.5"><div className="h-6 flex-1 rounded-md bg-[var(--bg-card)] border border-[var(--border-soft)]" /><div className="h-6 flex-1 rounded-md bg-[var(--bg-card)] border border-[var(--border-soft)]" /></div><div className="flex-1 rounded-md bg-[var(--bg-card)] border border-[var(--border-soft)]" /></div>
        </div>
      </div>
    );
  }
  return (
    <div className="h-[110px] rounded-lg border border-[var(--border-soft)] bg-[var(--bg-card)] overflow-hidden flex">
      <div className="w-[24%] bg-[var(--serviceops-tint)] border-r border-[var(--border-soft)] p-1.5 flex flex-col gap-1.5"><div className={`w-6 h-2 mb-0.5 ${accent}`} /><div className={`h-1.5 w-full ${bar}`} /><div className={`h-1.5 w-4/5 ${bar}`} /><div className={`h-1.5 w-full ${bar}`} /></div>
      <div className="flex-1 flex flex-col min-w-0">
        <div className="h-4 border-b border-[var(--border-soft)] flex items-center px-1.5"><div className={`h-1.5 w-8 ${bar}`} /></div>
        <div className="flex-1 p-1.5 flex flex-col gap-1.5"><div className="grid grid-cols-3 flex-1 border border-[var(--border-soft)] rounded-[3px]"><div className="border-r border-[var(--border-soft)]" /><div className="border-r border-[var(--border-soft)]" /><div /></div><div className="flex-1 border border-[var(--border-soft)] rounded-[3px] flex flex-col"><div className="h-2 bg-[var(--serviceops-tint)]" /><div className="h-px bg-[var(--border-soft)] mt-1.5" /><div className="h-px bg-[var(--border-soft)] mt-1.5" /></div></div>
      </div>
    </div>
  );
}

export default function AppearancePanel({ notify }: { notify: Notify }) {
  const { layout, setLayout } = useLayout();
  const [banner, setBanner] = useState<string | null>(null);
  const [image, setImage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => { fetch("/api/org").then(r => (r.ok ? r.json() : null)).then(o => { if (o) { setBanner(o.homeBanner ?? "photo"); setImage(o.homeBannerImage ?? null); } }).catch(() => {}); }, []);

  const save = async (patch: { homeBanner: string; homeBannerImage?: string | null }, applied: { banner: string; image?: string | null }) => {
    setBusy(true);
    const res = await fetch("/api/org", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
    setBusy(false);
    if (!res.ok) { notify(res.status === 403 ? "Only administrators can change the banner" : "Could not save the banner", undefined, "info"); return; }
    setBanner(applied.banner); if (applied.image !== undefined) setImage(applied.image);
    notify("Banner updated");
  };

  const upload = async (f?: File) => {
    if (!f) return;
    if (!/^image\/(jpeg|png|webp)$/.test(f.type)) { notify("Choose a JPEG, PNG or WebP image", undefined, "info"); return; }
    try { const url = await toBanner(f); await save({ homeBanner: "custom", homeBannerImage: url }, { banner: "custom", image: url }); }
    catch (e) { notify((e as Error).message, undefined, "info"); }
  };

  const tile = (key: string, label: string, style: React.CSSProperties, extra?: React.ReactNode) => {
    const on = banner === key;
    return (
      <button key={key} type="button" disabled={busy} aria-pressed={on} onClick={() => save({ homeBanner: key }, { banner: key })}
        className="text-left rounded-xl overflow-hidden border-2 transition-colors disabled:opacity-60" style={{ borderColor: on ? "var(--serviceops-primary)" : "var(--border-soft)" }}>
        <div className="h-[72px] relative flex items-center justify-center" style={style}>{extra}{on && <span className="absolute right-1.5 top-1.5 w-5 h-5 rounded-full bg-[var(--serviceops-primary)] flex items-center justify-center"><Check size={12} weight="bold" color="#3B1F00" /></span>}</div>
        <div className="px-2.5 py-1.5 text-[13px] font-semibold text-[var(--text-primary)] bg-[var(--bg-card)]">{label}</div>
      </button>
    );
  };

  return (
    <div>
      <BrandThemePanel notify={notify} />
      <p className="m-0 mb-3 text-label font-bold text-[var(--text-primary)]">Layout</p>
      <p className="m-0 mb-3 text-body text-[var(--text-body)]">How screens are arranged. Colours stay the same. This is saved on this device, so each person can choose their own.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8 max-w-[760px]">
        {LAYOUTS.map(l => {
          const on = layout === l.key;
          return (
            <button key={l.key} type="button" aria-pressed={on} onClick={() => { setLayout(l.key); notify(`${l.label} layout on`); }}
              className="text-left rounded-xl border-2 p-3 transition-colors bg-[var(--bg-card)]" style={{ borderColor: on ? "var(--serviceops-primary)" : "var(--border-soft)" }}>
              <LayoutSketch kind={l.key} />
              <span className="mt-2.5 flex items-center justify-between"><b className="text-[14px] text-[var(--text-primary)]">{l.label}</b>{on && <span className="w-5 h-5 rounded-full bg-[var(--serviceops-primary)] flex items-center justify-center"><Check size={12} weight="bold" color="#3B1F00" /></span>}</span>
              <span className="block mt-0.5 text-[12.5px] text-[var(--text-muted)]">{l.hint}</span>
            </button>
          );
        })}
      </div>

      <p className="m-0 mb-1 text-label font-bold text-[var(--text-primary)]">Home banner</p>
      <p className="m-0 mb-4 text-body text-[var(--text-body)]">The banner at the top of Home, in both layouts, for everyone in the company. Pick one, or upload your own picture.</p>

      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 mb-5">
        {tile("photo", "Original photo", { backgroundImage: `url(${PHOTO_URL})`, backgroundSize: "cover", backgroundPosition: "65% 35%" })}
        {BANNER_PRESETS.map(p => tile(p.key, p.label, { backgroundImage: p.css, backgroundSize: p.size ?? "cover" }))}
        {image && tile("custom", "Your upload", { backgroundImage: `url(${image})`, backgroundSize: "cover", backgroundPosition: "center" })}
        {tile("none", "No banner", { background: "var(--serviceops-tint)" }, <ProhibitInset size={22} className="text-[var(--text-muted)]" />)}
        <button type="button" disabled={busy} onClick={() => file.current?.click()} className="rounded-xl border-2 border-dashed border-[var(--border)] flex flex-col items-center justify-center gap-1 min-h-[102px] text-[13px] font-semibold text-[var(--text-primary)] hover:border-[var(--serviceops-primary)] disabled:opacity-60">
          <UploadSimple size={20} />Upload your own
          <span className="font-normal text-[11.5px] text-[var(--text-muted)]">JPEG, PNG or WebP</span>
        </button>
        <input ref={file} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={e => { upload(e.target.files?.[0]); e.target.value = ""; }} />
      </div>

      <p className="m-0 mb-2 text-caption font-semibold uppercase tracking-wide text-[var(--text-muted)]">Preview</p>
      {banner ? (
        <HomeBanner banner={banner} image={image} canEdit={false}>
          <p className="m-0 text-caption opacity-80">Tuesday, September 24, 2024</p>
          <p className="m-0 text-[26px] leading-[32px] font-bold tracking-tight">Good morning, Alex</p>
          <p className="m-0 mt-1 text-body opacity-90">5 visits today · 3 need attention</p>
        </HomeBanner>
      ) : <div className="h-[150px] rounded-2xl bg-[var(--serviceops-tint)]" />}
    </div>
  );
}
