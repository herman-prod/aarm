"use client";

import { useState } from "react";

// Muted, on-brand tints for the monogram fallback so every listing looks
// intentional even when a favicon is missing or blank.
const TINTS = [
  { bg: "#EEF4FF", fg: "#1A6EB5" },
  { bg: "#F0FBF4", fg: "#15803D" },
  { bg: "#FFF5EC", fg: "#C2570C" },
  { bg: "#F5F1FE", fg: "#6D28D9" },
  { bg: "#FEF2F4", fg: "#BE123C" },
  { bg: "#ECFBFB", fg: "#0E7490" },
];

function tintFor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return TINTS[h % TINTS.length];
}

function faviconUrl(domain?: string | null) {
  return domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=64` : "";
}

/**
 * Company logo tile with a graceful monogram fallback — used across the
 * registry and detail pages so a broken/blank favicon never looks unfinished.
 */
export function BuilderLogo({
  name, domain, logoUrl, className = "", imgSize = 20,
}: {
  name: string;
  domain?: string | null;
  logoUrl?: string | null;
  className?: string;
  imgSize?: number;
}) {
  const [failed, setFailed] = useState(false);
  const src = logoUrl || faviconUrl(domain);
  const show = src && !failed;
  const tint = tintFor(name || "?");
  const letter = (name?.trim()?.[0] ?? "?").toUpperCase();

  return (
    <div
      className={`flex items-center justify-center overflow-hidden ${className}`}
      style={show ? undefined : { backgroundColor: tint.bg }}
    >
      {show ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" width={imgSize} height={imgSize} className="rounded-sm" onError={() => setFailed(true)} />
      ) : (
        <span className="font-bold leading-none" style={{ color: tint.fg, fontSize: imgSize * 0.9 }}>{letter}</span>
      )}
    </div>
  );
}
