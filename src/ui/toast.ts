import type { ExtensionSettings } from "../types";

import { DOM_IDS } from "./dom-ids";
import { ensureKestrelStyles, prefersReducedMotion, themeFor } from "./styles";

// Lightweight toast notifications. Every piece of feedback the extension gives
// ("Mark 'a' set", "No hints available") was silent to screen readers because
// the element had no live region; it now announces politely.

let toastEl: HTMLElement | null = null;
let toastTimer: number | undefined;

/** Show a transient message. Announced via `aria-live="polite"`. */
export function showToast(message: string, duration = 1800, settings?: ExtensionSettings): void {
  if (typeof document === "undefined") return;
  ensureKestrelStyles();
  if (!toastEl || !toastEl.isConnected) {
    toastEl = document.createElement("div");
    toastEl.id = DOM_IDS.toast;
    toastEl.className = "kestrel-overlay";
    toastEl.setAttribute("role", "status");
    toastEl.setAttribute("aria-live", "polite");
    toastEl.setAttribute("aria-atomic", "true");
    Object.assign(toastEl.style, {
      bottom: "24px",
      left: "50%",
      transform: "translateX(-50%)",
      background: "rgba(20,20,28,0.95)",
      color: "#fff",
      padding: "8px 14px",
      borderRadius: "8px",
      font: "13px/1.4 system-ui, sans-serif",
      pointerEvents: "none",
      boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
      maxWidth: "80vw",
      textAlign: "center",
      transition: "opacity 0.2s",
      opacity: "0",
    } as CSSStyleDeclaration);
    document.documentElement.appendChild(toastEl);
  }
  if (settings) {
    const theme = themeFor(settings);
    if (theme.reducedMotion) toastEl.classList.add("kestrel-no-motion");
  } else if (prefersReducedMotion()) {
    toastEl.classList.add("kestrel-no-motion");
  }
  toastEl.textContent = message;
  toastEl.style.opacity = "1";
  if (toastTimer) window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    if (toastEl) toastEl.style.opacity = "0";
  }, duration);
}

/** Test helper: read the currently displayed toast text (or null). */
export function currentToastText(): string | null {
  return toastEl ? toastEl.textContent : null;
}

// Back-compat: badge lives in ./badge.ts now.
export { setModeBadge, isBadgeVisible } from "./badge";
