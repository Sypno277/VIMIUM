import type { ExtensionSettings, HintTarget } from "../types";
import { DOM_IDS } from "../ui/dom-ids";
import { applyTheme, ensureKestrelStyles, themeFor, type Theme } from "../ui/styles";

// Rendering only — no policy, no key handling. The controller decides what is
// visible; this class paints it.
//
// §3.6: labels are positioned from `getBoundingClientRect()` **at paint time**,
// so they track the page when it scrolls. Offscreen targets are culled and
// detached elements are dropped.
// §3.19: one span is created per target and reused for the whole session
// (visibility toggled), instead of rebuilding every label per keystroke.
// D8: the scan is whole-document, so culling happens *only* here, at paint
//     time — labels for newly scrolled-into-view targets appear immediately.
// D9: the HUD counts pills that actually painted, not the pre-cull filter set.

interface Pill {
  el: HTMLElement;
  target: HintTarget;
  label: string;
}

export class HintOverlay {
  private readonly container: HTMLElement;
  private readonly hud: HTMLElement;
  private readonly pills: Pill[] = [];
  private readonly theme: Theme;
  private readonly fontScale: number;
  private attached = false;
  /** Last requested filter set, so a scroll repaint keeps the same labels. */
  private visibleIds: Set<number> = new Set();
  private typed = "";
  private selectedIds: Set<number> | undefined;

  constructor(settings: ExtensionSettings, targets: HintTarget[], labels: string[]) {
    ensureKestrelStyles();
    this.theme = themeFor(settings);
    this.fontScale = settings.hints.fontSizeScale;

    this.container = document.createElement("div");
    this.container.id = DOM_IDS.hints;
    this.container.className = "kestrel-overlay";
    Object.assign(this.container.style, {
      inset: "0",
      pointerEvents: "none",
      zIndex: "2147483645",
    } as CSSStyleDeclaration);
    applyTheme(this.container, this.theme);

    this.hud = document.createElement("div");
    this.hud.id = DOM_IDS.hintHud;
    this.hud.setAttribute("role", "status");
    this.hud.setAttribute("aria-live", "polite");
    Object.assign(this.hud.style, {
      position: "fixed",
      top: "10px",
      left: "50%",
      transform: "translateX(-50%)",
      background: this.theme.panel,
      color: this.theme.text,
      border: `1px solid ${this.theme.border}`,
      borderRadius: "8px",
      padding: "4px 12px",
      font: `600 ${13 * this.fontScale}px/1.4 ${this.theme.fontFamily}`,
      display: "none",
      pointerEvents: "none",
    } as CSSStyleDeclaration);
    this.container.appendChild(this.hud);

    for (let i = 0; i < targets.length; i++) {
      const el = document.createElement("span");
      el.textContent = labels[i];
      Object.assign(el.style, {
        position: "fixed",
        display: "none",
        background: this.theme.hintBg,
        color: this.theme.hintText,
        fontSize: `${11 * this.fontScale}px`,
        fontWeight: "700",
        padding: "0 3px",
        borderRadius: "3px",
        fontFamily: "monospace",
        lineHeight: "1.2",
        boxShadow: "0 1px 2px rgba(0,0,0,0.5)",
        outline: `1px solid ${this.theme.hintOutline}`,
        zIndex: "2147483645",
      } as CSSStyleDeclaration);
      this.container.appendChild(el);
      this.pills.push({ el, target: targets[i], label: labels[i] });
    }
    if (this.theme.reducedMotion) this.container.classList.add("kestrel-no-motion");
  }

  /** Attach the overlay to the page. */
  mount(): void {
    if (this.attached) return;
    document.documentElement.appendChild(this.container);
    this.attached = true;
  }

  /**
   * Show `visible` pills (by target id) and update the HUD. `selected` pills
   * (visual mode) get the accent fill so a multi-select is legible while more
   * labels are still being typed.
   */
  render(visibleIds: Set<number>, typed: string, selected?: Set<number>): void {
    this.visibleIds = visibleIds;
    this.typed = typed;
    this.selectedIds = selected;
    this.paint();
  }

  /** Reposition from live geometry (scroll/resize) and refresh the HUD count. */
  reposition(): void {
    this.paint();
  }

  /**
   * Lay out every pill for the current filter set, counted from what actually
   * painted. A pill paints only when its element is connected and intersects
   * the viewport, so the HUD and the screen always agree (D9).
   */
  private paint(): void {
    if (!this.attached) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let painted = 0;

    for (let i = 0; i < this.pills.length; i++) {
      const pill = this.pills[i];
      if (!this.visibleIds.has(i)) {
        pill.el.style.display = "none";
        continue;
      }
      const el = pill.target.element;
      if (!el.isConnected) {
        pill.el.style.display = "none";
        continue;
      }
      const r = el.getBoundingClientRect();
      const offscreen = r.bottom < 0 || r.top > vh || r.right < 0 || r.left > vw;
      if (offscreen) {
        pill.el.style.display = "none";
        continue;
      }
      pill.el.style.display = "block";
      pill.el.style.left = `${Math.max(0, r.left)}px`;
      pill.el.style.top = `${Math.max(0, r.top)}px`;
      const isSelected = this.selectedIds?.has(i) ?? false;
      pill.el.style.background = isSelected ? this.theme.accent : this.theme.hintBg;
      pill.el.style.color = isSelected ? this.theme.accentText : this.theme.hintText;
      painted++;
    }

    this.hud.textContent = this.typed
      ? `${this.typed} · ${painted} match${painted === 1 ? "" : "es"}`
      : "";
    this.hud.style.display = this.typed ? "block" : "none";
  }

  /** Remove the overlay from the page. */
  destroy(): void {
    this.container.remove();
    this.attached = false;
    this.pills.length = 0;
  }
}
