"use client";
import { useEffect, useRef, useState } from "react";
import { Check, UploadSimple, ArrowCounterClockwise } from "@phosphor-icons/react";
import { useBrand } from "@/components/BrandContext";
import { BRAND_THEMES, colorFromLogo, DEFAULT_BRAND, DEFAULT_CUSTOM, fromPrimary, readableOnWhite, textOn, type BrandColors, type BrandSetting } from "@/lib/brandTheme";

type Notify = (msg: string, href?: string, severity?: "success" | "info") => void;

/** A small picture of the app in a set of colours. Only a preview. */
function Preview({ c }: { c: BrandColors | null }) {
  const primary = c?.action ?? "#F59E0B", tint = c?.tint ?? "#F7F7F7";
  return (
    <div aria-hidden className="flex h-[88px] overflow-hidden rounded-lg border border-[var(--border-soft)] bg-[var(--bg-card)]">
      <div className="flex w-9 flex-col gap-1.5 border-r border-[var(--border-soft)] p-1.5" style={{ background: tint }}>
        <span className="h-1.5 rounded-[2px]" style={{ background: primary }} />
        <span className="h-1.5 rounded-[2px] bg-[var(--border)]" /><span className="h-1.5 rounded-[2px] bg-[var(--border)]" />
      </div>
      <div className="flex-1 space-y-1.5 p-2">
        <div className="h-5 rounded-md" style={{ background: tint }} />
        <div className="flex gap-1.5">
          <span className="h-5 flex-1 rounded-md border border-[var(--border-soft)]" />
          <span className="h-5 w-12 rounded-md" style={{ background: primary }} />
        </div>
        <div className="h-5 rounded-md border border-[var(--border-soft)]" />
      </div>
    </div>
  );
}

const same = (a: BrandSetting, b: BrandSetting) => a.theme === b.theme && a.custom?.primary === b.custom?.primary;

/** Ready-made colour themes plus a brand editor that can take its colour from the company logo. Administrators only; everyone sees the result. */
export default function BrandThemePanel({ notify }: { notify: Notify }) {
  const { brand, saved, preview, commit } = useBrand();
  const [color, setColor] = useState(DEFAULT_CUSTOM.primary);
  const [logo, setLogo] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  const dirty = !same(brand, saved);
  // Show the saved custom colour in the picker once it has loaded.
  useEffect(() => { if (saved.theme === "custom" && saved.custom) setColor(saved.custom.primary); }, [saved]);
  // Leaving the page without saving puts the saved look back.
  useEffect(() => () => preview(null), [preview]);

  const save = async (b: BrandSetting, msg: string) => {
    setBusy(true);
    const ok = await commit(b);
    setBusy(false);
    if (ok) notify(msg); else notify("Only administrators can change the theme", undefined, "info");
  };
  const pick = (id: string) => { const b: BrandSetting = { theme: id, custom: null }; preview(b); };
  const setCustom = (hex: string) => { setColor(hex); preview({ theme: "custom", custom: { primary: hex } }); };

  const onLogo = async (f?: File) => {
    if (!f) return;
    setNote(""); setBusy(true);
    try {
      const c = await colorFromLogo(f);
      setLogo(URL.createObjectURL(f));
      if (!c) setNote("No clear brand colour was found in that logo. Pick a colour yourself.");
      else { setCustom(c); setNote(readableOnWhite(c) !== c ? "Colour taken from your logo. Text and links use a slightly darker shade so they stay readable." : "Colour taken from your logo. Adjust it if you like."); }
    } catch (e) { setNote((e as Error).message); }
    finally { setBusy(false); }
  };

  const customOn = brand.theme === "custom";
  const cc = fromPrimary(color);

  return (
    <div className="mb-8">
      <p className="m-0 mb-1 text-label font-bold text-[var(--text-primary)]">Colour theme</p>
      <p className="m-0 mb-4 text-body text-[var(--text-body)]">The brand colour used for buttons, links and highlights, for everyone in the company. It changes colours only. Dark mode keeps its own palette.</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 mb-4">
        {BRAND_THEMES.map(t => {
          const on = brand.theme === t.id;
          return (
            <button key={t.id} type="button" aria-pressed={on} disabled={busy} onClick={() => pick(t.id)}
              className="text-left rounded-xl border-2 p-2.5 bg-[var(--bg-card)] transition-colors disabled:opacity-60" style={{ borderColor: on ? "var(--serviceops-primary)" : "var(--border-soft)" }}>
              <Preview c={t.colors} />
              <span className="mt-2 flex items-center justify-between gap-2">
                <b className="text-[14px] text-[var(--text-primary)]">{t.name}</b>
                {on && <span className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: "var(--serviceops-action)", color: textOn(t.colors?.action ?? "#F59E0B") }}><Check size={12} weight="bold" /></span>}
              </span>
              <span className="block mt-0.5 text-[12.5px] text-[var(--text-muted)]">{t.audience} · {t.description}</span>
            </button>
          );
        })}
      </div>

      <div className="rounded-xl border-2 p-3 bg-[var(--bg-card)] max-w-[760px]" style={{ borderColor: customOn ? "var(--serviceops-primary)" : "var(--border-soft)" }}>
        <p className="m-0 text-[14px] font-bold text-[var(--text-primary)]">Your own brand colour</p>
        <p className="m-0 mt-0.5 mb-3 text-[12.5px] text-[var(--text-muted)]">Upload your logo to take its main colour, or pick one yourself. The image is read in this browser and is not uploaded or saved.</p>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-2.5 py-1.5 cursor-pointer">
            <input type="color" value={color} onChange={e => setCustom(e.target.value)} aria-label="Brand colour" className="w-8 h-8 p-0 border-0 bg-transparent cursor-pointer" />
            <span className="text-[13px] font-mono text-[var(--text-body)]">{color.toUpperCase()}</span>
          </label>
          <button type="button" disabled={busy} onClick={() => file.current?.click()} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-2 text-[13px] font-semibold text-[var(--text-primary)] hover:border-[var(--serviceops-primary)] disabled:opacity-60">
            <UploadSimple size={16} />{busy ? "Reading logo…" : "Take colour from logo"}
          </button>
          <input ref={file} type="file" accept="image/*" className="sr-only" onChange={e => { onLogo(e.target.files?.[0]); e.target.value = ""; }} />
          {logo && /* eslint-disable-next-line @next/next/no-img-element */ <img src={logo} alt="Your logo" className="h-8 max-w-[120px] object-contain" />}
          <div className="w-40"><Preview c={cc} /></div>
        </div>
        {note && <p className="m-0 mt-2 text-[12.5px] text-[var(--text-muted)]">{note}</p>}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button type="button" disabled={!dirty || busy} onClick={() => save(brand, "Theme applied")}
          className="rounded-lg px-4 py-2 text-[14px] font-semibold disabled:opacity-50" style={{ background: "var(--serviceops-action)", color: "var(--theme-on-action, #111)" }}>Use this theme</button>
        <button type="button" disabled={busy || (saved.theme === "serviceops" && !dirty)} onClick={() => { setColor(DEFAULT_CUSTOM.primary); setLogo(null); setNote(""); save(DEFAULT_BRAND, "Back to the default theme"); }}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-2 text-[13px] font-semibold text-[var(--text-primary)] disabled:opacity-50"><ArrowCounterClockwise size={15} />Reset to default</button>
        {dirty && <span className="text-[12.5px] text-[var(--text-muted)]">Previewing. Nothing is saved until you choose Use this theme.</span>}
      </div>
    </div>
  );
}
