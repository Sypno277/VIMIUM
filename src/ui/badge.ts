import type { ExtensionSettings } from "../types";

import { DOM_IDS } from "./dom-ids";
import { ensureKestrelStyles, themeFor } from "./styles";

// The "which mode am I in?" badge. The plan flagged it as silent to assistive
// tech — the whole affordance that stops users getting stuck was unannounced —
// so it is now an `aria-live="polite"` status region.

let badgeEl: HTMLElement | null = null;
let hideTimer: number | undefined;

/** Mode → accent colour. Kept here so every caller agrees. */
const BADGE_COLORS: Record<string, string> = {
  normal: "#3b82f6",
  insert: "#f59e0b",
  hint: "#10b981",
  visual: "#a855f7",
  find: "#ef4444",
  command: "#14b8a6",
};

/**
 * Update the persistent mode indicator. `visible=false` fades it out but keeps
 * the live region in the DOM so the change is still announced.
 */
export function setModeBadge(mode: string, visible = true, settings?: ExtensionSettings): void {
  if (typeof document === "undefined") return;
  ensureKestrelStyles();
  if (!badgeEl || !badgeEl.isConnected) {
    badgeEl = document.createElement("div");
    badgeEl.id = DOM_IDS.modeBadge;
    badgeEl.className = "kestrel-overlay";
    badgeEl.setAttribute("role", "status");
    badgeEl.setAttribute("aria-live", "polite");
    Object.assign(badgeEl.style, {
      top: "8px",
      right: "8px",
      padding: "2px 8px",
      borderRadius: "10px",
      color: "#fff",
      font: "bold 11px/1.4 system-ui, sans-serif",
      pointerEvents: "none",
      transition: "opacity 0.2s",
    } as CSSStyleDeclaration);
    if (settings) {
      const theme = themeFor(settings);
      if (theme.reducedMotion) badgeEl.classList.add("kestrel-no-motion");
    }
    document.documentElement.appendChild(badgeEl);
  }
  const label = mode.charAt(0).toUpperCase() + mode.slice(1);
  badgeEl.textContent = `Kestrel: ${label}`;
  badgeEl.style.background = BADGE_COLORS[mode] ?? "#333";
  badgeEl.style.opacity = visible ? "1" : "0";
  badgeEl.style.display = visible ? "block" : "none";

  if (hideTimer) window.clearTimeout(hideTimer);
  if (!visible) {
    hideTimer = window.setTimeout(() => {
      if (badgeEl) badgeEl.style.display = "none";
    }, 200);
  }
}

/** Test helper: is the badge currently painted? */
export function isBadgeVisible(): boolean {
  return !!badgeEl && badgeEl.style.display !== "none" && badgeEl.style.opacity === "1";
}
