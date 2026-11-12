import type { ExtensionSettings } from "../types";

// One injected stylesheet for every overlay, plus a cached reduced-motion
// query. The plan found `matchMedia` being re-queried per scroll event and
// colours hard-coded in three places; both live here now.

const STYLE_ID = "kestrel-styles";

let installed = false;

export interface Theme {
  bg: string;
  panel: string;
  panelAlt: string;
  text: string;
  muted: string;
  accent: string;
  accentText: string;
  border: string;
  hintBg: string;
  hintText: string;
  hintOutline: string;
  fontFamily: string;
  reducedMotion: boolean;
}

/** Read the palette for the current settings (accessibility toggles included). */
export function themeFor(settings: ExtensionSettings): Theme {
  const highContrast = settings.hints.highContrast;
  const colorblindSafe = settings.hints.colorblindSafe;
  const hintBg = highContrast ? "#000000" : colorblindSafe ? "#003f5c" : "#2563eb";
  return {
    bg: highContrast ? "#000000" : "#0b1120",
    panel: highContrast ? "#000000" : "#111827",
    panelAlt: highContrast ? "#111111" : "#1f2937",
    text: highContrast ? "#ffffff" : "#e5e7eb",
    muted: highContrast ? "#d1d5db" : "#9ca3af",
    accent: highContrast ? "#ffffff" : "#3b82f6",
    accentText: highContrast ? "#000000" : "#ffffff",
    border: highContrast ? "#ffffff" : "#374151",
    hintBg,
    hintText: "#ffffff",
    // A ring in the inverse colour so labels survive over dark imagery
    // (the real accessibility complaint in §3.14).
    hintOutline: highContrast ? "#ffffff" : "rgba(255,255,255,0.85)",
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
    reducedMotion: prefersReducedMotion(),
  };
}

let reducedMotionQuery: MediaQueryList | null = null;

/** Cached `prefers-reduced-motion` check (never re-queries per scroll). */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  if (!reducedMotionQuery) {
    reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  }
  return reducedMotionQuery.matches;
}

/** Install the shared stylesheet once per document. */
export function ensureKestrelStyles(): void {
  if (installed || typeof document === "undefined") return;
  if (document.getElementById(STYLE_ID)) {
    installed = true;
    return;
  }
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = STYLESHEET;
  document.documentElement.appendChild(style);
  installed = true;
}

const STYLESHEET = `
.kestrel-overlay {
  position: fixed;
  z-index: 2147483647;
  font-family: var(--k-font);
  color: var(--k-text);
  box-sizing: border-box;
}
.kestrel-overlay * { box-sizing: border-box; }
.kestrel-backdrop {
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: flex-start;
  justify-content: center;
}
.kestrel-panel {
  background: var(--k-panel);
  border: 1px solid var(--k-border);
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  overflow: hidden;
}
.kestrel-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 14px;
  cursor: pointer;
}
.kestrel-row[aria-selected="true"] { background: var(--k-accent); color: var(--k-accent-text); }
.kestrel-row:hover { background: var(--k-panel-alt); }
.kestrel-row[aria-selected="true"]:hover { background: var(--k-accent); }
.kestrel-input {
  width: 100%;
  border: none;
  outline: none;
  padding: 12px 14px;
  font-size: 15px;
  background: transparent;
  color: var(--k-text);
  font-family: var(--k-font);
}
.kestrel-muted { color: var(--k-muted); }
.kestrel-footer {
  border-top: 1px solid var(--k-border);
  padding: 8px 14px;
  font-size: 12px;
  color: var(--k-muted);
  display: flex;
  justify-content: space-between;
  gap: 12px;
}
.kestrel-badge {
  border-radius: 999px;
  padding: 1px 8px;
  font-size: 11px;
  background: var(--k-panel-alt);
  color: var(--k-muted);
}
.kestrel-visually-hidden {
  position: absolute !important;
  width: 1px; height: 1px;
  margin: -1px; padding: 0; border: 0;
  clip: rect(0 0 0 0); clip-path: inset(50%);
  overflow: hidden; white-space: nowrap;
}
.kestrel-no-motion, .kestrel-no-motion * { transition: none !important; animation: none !important; }
`;

/** Apply the theme's custom properties to an overlay element. */
export function applyTheme(el: HTMLElement, theme: Theme): void {
  const style = el.style;
  style.setProperty("--k-bg", theme.bg);
  style.setProperty("--k-panel", theme.panel);
  style.setProperty("--k-panel-alt", theme.panelAlt);
  style.setProperty("--k-text", theme.text);
  style.setProperty("--k-muted", theme.muted);
  style.setProperty("--k-accent", theme.accent);
  style.setProperty("--k-accent-text", theme.accentText);
  style.setProperty("--k-border", theme.border);
  style.setProperty("--k-font", theme.fontFamily);
  if (theme.reducedMotion) el.classList.add("kestrel-no-motion");
}
