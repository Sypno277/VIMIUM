import type { ExtensionSettings } from "../types";
import { DOM_IDS } from "../ui/dom-ids";
import { ensureKestrelStyles, themeFor } from "../ui/styles";

// Opt-in debug overlay: answers "why did that key do nothing?" in one glance —
// last key, resolved command, active profiles, insert-mode confidence and the
// hint scan budget. Ships disabled; toggled from Settings → Accessibility or
// the `openInspector` command.

export interface InspectorSnapshot {
  lastKey: string;
  resolved: string;
  mode: string;
  profiles: string[];
  insertConfidence: number;
  insertProfile: string;
  hintScanMs: number;
  note: string;
}

const EMPTY: InspectorSnapshot = {
  lastKey: "—",
  resolved: "—",
  mode: "normal",
  profiles: [],
  insertConfidence: 0,
  insertProfile: "",
  hintScanMs: 0,
  note: "",
};

export class Inspector {
  private el: HTMLElement | null = null;
  private snapshot: InspectorSnapshot = { ...EMPTY };

  get isOpen(): boolean {
    return this.el !== null;
  }

  /** Toggle the overlay. Returns its new open state. */
  toggle(settings: ExtensionSettings): boolean {
    if (this.el) {
      this.close();
      return false;
    }
    this.open(settings);
    return true;
  }

  open(settings: ExtensionSettings): void {
    if (this.el) return;
    ensureKestrelStyles();
    const theme = themeFor(settings);
    const el = document.createElement("div");
    el.id = DOM_IDS.inspector;
    el.className = "kestrel-overlay";
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", "polite");
    Object.assign(el.style, {
      position: "fixed",
      top: "42px",
      right: "8px",
      minWidth: "240px",
      background: theme.panel,
      color: theme.text,
      border: `1px solid ${theme.border}`,
      borderRadius: "8px",
      padding: "8px 10px",
      font: `12px/1.6 ${theme.fontFamily}`,
      zIndex: "2147483646",
      pointerEvents: "none",
      whiteSpace: "pre",
    } as CSSStyleDeclaration);
    document.documentElement.appendChild(el);
    this.el = el;
    this.paint();
  }

  close(): void {
    this.el?.remove();
    this.el = null;
  }

  /** Merge new values into the snapshot and repaint when visible. */
  update(patch: Partial<InspectorSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch };
    this.paint();
  }

  reset(): void {
    this.snapshot = { ...EMPTY };
    this.paint();
  }

  private paint(): void {
    if (!this.el) return;
    const s = this.snapshot;
    const lines = [
      `key      ${s.lastKey}`,
      `command  ${s.resolved}`,
      `mode     ${s.mode}`,
      `insert   ${s.insertConfidence.toFixed(2)}${s.insertProfile ? ` (${s.insertProfile})` : ""}`,
      `profiles ${s.profiles.length ? s.profiles.join(", ") : "none"}`,
      `scan     ${s.hintScanMs.toFixed(1)} ms`,
    ];
    if (s.note) lines.push(`note     ${s.note}`);
    this.el.textContent = lines.join("\n");
  }
}

export const inspector = new Inspector();
