import type { ExtensionSettings } from "../types";

import { applyTheme, ensureKestrelStyles, themeFor, type Theme } from "./styles";

// Every overlay (palette, cheat sheet, omnibar, tab search, find, visual)
// extends this base so focus management, ARIA and Escape-to-dismiss are
// implemented exactly once. The §3.14 complaint — "div soup with no role and
// no focus management" — cannot recur while this is the only door.

export interface ModalOptions {
  /** The element id (from DOM_IDS) so key handlers can recognise the overlay. */
  id: string;
  /** Accessible name announced by screen readers. */
  ariaLabel: string;
  /** Called exactly once when the user dismisses the modal (Escape/backdrop). */
  onDismiss: () => void;
  /**
   * Whether to dim the page behind the panel. Find uses `false` so the user
   * can still read the page while the find bar is open.
   */
  backdrop?: boolean;
}

export abstract class Modal {
  protected readonly root: HTMLElement;
  /** The visual panel (focus-trapped region); subclasses populate this. */
  protected readonly panel: HTMLElement;
  protected readonly theme: Theme;

  private previouslyFocused: Element | null;
  private dismissed = false;
  private readonly dismissCallback: () => void;
  private readonly onKeyDownCapture: (e: KeyboardEvent) => void;

  constructor(opts: ModalOptions, settings: ExtensionSettings) {
    ensureKestrelStyles();
    this.theme = themeFor(settings);
    this.dismissCallback = opts.onDismiss;
    this.previouslyFocused = typeof document !== "undefined" ? document.activeElement : null;
    this.onKeyDownCapture = (e: KeyboardEvent) => this.handleKeyCapture(e);

    const backdrop = opts.backdrop !== false;
    this.root = document.createElement("div");
    this.root.id = opts.id;
    this.root.className = backdrop ? "kestrel-overlay kestrel-backdrop" : "kestrel-overlay";
    this.root.setAttribute("role", "dialog");
    this.root.setAttribute("aria-modal", "true");
    this.root.setAttribute("aria-label", opts.ariaLabel);
    applyTheme(this.root, this.theme);

    this.panel = document.createElement("div");
    this.panel.className = "kestrel-panel";
    this.root.appendChild(this.panel);

    this.root.addEventListener("keydown", this.onKeyDownCapture, true);
    if (backdrop) {
      this.root.addEventListener("mousedown", (e) => {
        if (e.target === this.root) this.dismiss();
      });
    }
    document.documentElement.appendChild(this.root);
  }

  /** Focus the first focusable element (usually the input). */
  protected focusFirst(): void {
    const target = this.panel.querySelector("[data-autofocus]") as HTMLElement | null;
    const first = target ?? (this.panel.querySelector("input, textarea, select, button") as HTMLElement | null);
    first?.focus();
  }

  /** Remove the overlay and restore focus. Safe to call more than once. */
  close(): void {
    this.root.remove();
    this.root.removeEventListener("keydown", this.onKeyDownCapture, true);
    const restore = this.previouslyFocused;
    this.previouslyFocused = null;
    if (restore instanceof HTMLElement && restore.isConnected) {
      try {
        restore.focus();
      } catch {
        /* element may not be focusable any more */
      }
    }
  }

  /** Request dismissal: runs the callback once, then closes. */
  protected dismiss(): void {
    if (this.dismissed) return;
    this.dismissed = true;
    this.close();
    this.dismissCallback();
  }

  /** True once the modal has been dismissed (guards double settlement). */
  protected get isDismissed(): boolean {
    return this.dismissed;
  }

  /** True while the overlay is still attached to the document. */
  isOpen(): boolean {
    return this.root.isConnected;
  }

  private handleKeyCapture(e: KeyboardEvent): void {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      this.dismiss();
      return;
    }
    if (e.key === "Tab") this.trapFocus(e);
  }

  /** Keep Tab / Shift+Tab cycling inside the panel. */
  private trapFocus(e: KeyboardEvent): void {
    const focusables = Array.from(
      this.panel.querySelectorAll("input, textarea, select, button, a[href], [tabindex]"),
    ).filter(
      (el): el is HTMLElement =>
        el instanceof HTMLElement && !el.hasAttribute("disabled") && el.tabIndex >= 0,
    );
    if (focusables.length === 0) {
      e.preventDefault();
      return;
    }
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && (active === first || !this.panel.contains(active))) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  }
}
