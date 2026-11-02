import type { CSSProperties } from "react";

/** The ServiceOps wordmark. Shows the light artwork in dark mode (see .logo-img in globals.css). */
export default function Logo({ style, onError }: { style?: CSSProperties; onError?: React.ReactEventHandler<HTMLImageElement> }) {
  return (
    <span className="logo-img" style={{ display: "inline-flex", flexShrink: 0 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="logo-dark" src="/logo.png" alt="ServiceOps" style={style} onError={onError} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="logo-light" src="/logo-light.png" alt="" aria-hidden="true" style={style} onError={onError} />
    </span>
  );
}
