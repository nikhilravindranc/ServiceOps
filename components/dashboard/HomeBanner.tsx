"use client";
import { useState, type ReactNode } from "react";
import Link from "next/link";
import { PencilSimple } from "@phosphor-icons/react";
import { BANNER_PRESETS, PHOTO_URL, bannerPreset } from "@/lib/banners";

type Props = {
  banner: string | null; image: string | null; canEdit: boolean; children: ReactNode;
  /** Compact layout: a slimmer band, with action buttons on its right edge. */
  slim?: boolean; actions?: ReactNode;
};

/** The picture band at the top of Home. Text sits on the left; what is behind it is chosen in Settings, Appearance. */
export default function HomeBanner({ banner, image, canEdit, children, slim = false, actions }: Props) {
  const [photoFailed, setPhotoFailed] = useState(false);
  const preset = banner ? bannerPreset(banner) : undefined;
  const usePhoto = banner === "photo" && !photoFailed;
  const useCustom = banner === "custom" && !!image;
  // A photo that cannot load falls back to a quiet gradient instead of an empty box.
  const fallback = banner === "photo" || (banner === "custom" && !image) ? BANNER_PRESETS[1] : preset;
  const dark = useCustom ? false : usePhoto ? true : fallback?.darkText ?? true;

  if (banner === "none") {
    return (
      <header className={`${slim ? "" : "mb-5"} flex items-end justify-between gap-4 flex-wrap`}>
        <div className="min-w-0">{children}</div>
        <div className="flex items-center gap-3">
          {actions}
          {canEdit && <Link href="/settings?tab=appearance" className="text-caption text-[var(--text-muted)] hover:text-[var(--text-primary)]">Add a banner</Link>}
        </div>
      </header>
    );
  }

  const textColor = dark ? "var(--text-primary)" : "#FFFFFF";
  const size = slim ? "min-h-[104px] rounded-[10px] items-center" : "mb-5 min-h-[150px] sm:min-h-[170px] rounded-2xl items-end";
  return (
    <header className={`relative overflow-hidden border border-[var(--border-soft)] flex ${size}`}>
      {/* Background */}
      <div className="absolute inset-0" aria-hidden style={!usePhoto && !useCustom && fallback ? { backgroundImage: fallback.css, backgroundSize: fallback.size ?? "cover" } : { background: !usePhoto && !useCustom ? "var(--serviceops-tint)" : undefined }}>
        {usePhoto && (
          <>
            <img src={PHOTO_URL} alt="" onError={() => setPhotoFailed(true)} className={`absolute inset-0 h-full w-full object-cover ${slim ? "object-[65%_42%]" : "object-[65%_35%]"}`} />
            <div className="absolute inset-0" style={{ background: "linear-gradient(90deg, var(--bg-page) 0%, color-mix(in srgb, var(--bg-page) 88%, transparent) 28%, color-mix(in srgb, var(--bg-page) 30%, transparent) 55%, transparent 75%)" }} />
          </>
        )}
        {useCustom && (
          <>
            <img src={image!} alt="" className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0" style={{ background: "linear-gradient(90deg, rgba(0,0,0,.55) 0%, rgba(0,0,0,.25) 60%, rgba(0,0,0,.05) 100%)" }} />
          </>
        )}
      </div>

      <div className={`relative z-10 w-full flex flex-wrap items-center justify-between gap-3 ${slim ? "px-5 py-4" : "px-5 sm:px-7 py-5 sm:py-6"}`} style={{ color: textColor }}>
        <div className="min-w-0">{children}</div>
        {actions && <div className="flex items-center gap-2 flex-shrink-0 mt-2 sm:mt-0">{actions}</div>}
      </div>

      {canEdit && (slim ? (
        <Link href="/settings?tab=appearance" aria-label="Change banner" title="Change banner"
          className="absolute right-2 top-2 z-10 inline-flex items-center justify-center w-7 h-7 rounded-md no-underline bg-black/30 text-white hover:bg-black/50 backdrop-blur-sm">
          <PencilSimple size={13} weight="bold" />
        </Link>
      ) : (
        <Link href="/settings?tab=appearance" aria-label="Change banner"
          className="absolute right-3 top-3 z-10 inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12.5px] font-semibold no-underline bg-black/35 text-white hover:bg-black/50 backdrop-blur-sm">
          <PencilSimple size={13} weight="bold" />Change banner
        </Link>
      ))}
    </header>
  );
}
