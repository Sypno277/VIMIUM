import { findHintTargets } from "../hints/element-finder";
import { assignHintLabels } from "../hints/hint-labels";
import { HintOverlay } from "../hints/hint-overlay";
import { defaultEngine, engineUrl } from "../omnibar/engines";
import type { ExtensionSettings, HintTarget } from "../types";
import { DOM_IDS } from "../ui/dom-ids";
import { ensureKestrelStyles, themeFor } from "../ui/styles";
import { showToast } from "../ui/toast";

import {
  copyText,
  openLinks,
  selectionLinks,
  selectionText,
} from "./selection-actions";

// Visual mode (`v`): hint-select several elements, then act on the selection —
// `y` copy text, `Y` copy links, `o`/`O` open links, `s` search the text.

type Phase = "selecting" | "action";

const PRINTABLE = /^[0-9a-z]$/;

export class VisualController {
  private overlay: HintOverlay | null = null;
  private toolbar: HTMLElement | null = null;
  private targets: HintTarget[] = [];
  private labels: string[] = [];
  private selected = new Set<number>();
  private typed = "";
  private settings: ExtensionSettings | null = null;
  private phase: Phase = "selecting";
  private active = false;
  private onExit: () => void = () => undefined;

  /** Enter visual mode. Returns false when the page has no hint targets. */
  enter(settings: ExtensionSettings, onExit: () => void): boolean {
    if (this.active) this.reset();
    this.settings = settings;
    this.onExit = onExit;
    this.targets = findHintTargets(document, { smartFiltering: settings.hints.smartFiltering });
    if (this.targets.length === 0) return false;

    this.labels = assignHintLabels(this.targets, {
      chars: settings.hints.chars,
      style: settings.hints.style,
      homeRowPriority: settings.hints.homeRowPriority,
    });

    this.overlay = new HintOverlay(settings, this.targets, this.labels);
    this.overlay.mount();
    this.active = true;
    this.phase = "selecting";
    this.typed = "";
    this.selected = new Set();
    this.refresh();
    this.buildToolbar();
    return true;
  }

  /** Feed a normalized key token. Returns true while visual mode stays open. */
  feed(token: string): boolean {
    if (!this.active) return false;

    if (token === "Escape" || token === "Ctrl+[" || token === "Meta+[") {
      this.reset();
      return false;
    }

    if (this.phase === "selecting") return this.feedSelecting(token);
    return this.feedAction(token);
  }

  /** Programmatic cancel (e.g. a settings change or navigation). */
  cancel(): void {
    if (this.active) this.reset();
  }

  get isActive(): boolean {
    return this.active;
  }

  /** The selected elements, in target order (test/debug aid). */
  get selectedElements(): Element[] {
    return [...this.selected].sort((a, b) => a - b).map((i) => this.targets[i].element);
  }

  // ---- selection phase ---------------------------------------------------

  private feedSelecting(token: string): boolean {
    if (token === "Backspace") {
      this.typed = this.typed.slice(0, -1);
      this.refresh();
      return true;
    }
    if (token === "Enter") {
      if (this.selected.size === 0) {
        this.reset();
        return false;
      }
      this.phase = "action";
      this.typed = "";
      this.refresh();
      this.updateToolbar();
      return true;
    }

    const lower = token.length === 1 ? token.toLowerCase() : token;
    if (!PRINTABLE.test(lower)) return true;

    const candidate = this.typed + lower;
    const matches = this.matching(candidate);
    if (matches.length === 1) {
      this.toggle(matches[0]);
      this.typed = "";
    } else if (matches.length === 0) {
      this.typed = "";
    } else {
      this.typed = candidate;
    }
    this.refresh();
    return true;
  }

  // ---- action phase ------------------------------------------------------

  private feedAction(token: string): boolean {
    const elements = this.selectedElements;
    switch (token) {
      case "y":
        void copyText(selectionText(elements)).then((ok) =>
          showToast(ok ? `Copied ${elements.length} selection(s)` : "Copy failed"),
        );
        this.reset();
        return false;
      case "Shift+Y": {
        const links = selectionLinks(elements);
        void copyText(links.join("\n")).then((ok) =>
          showToast(ok ? `Copied ${links.length} link(s)` : "No links to copy"),
        );
        this.reset();
        return false;
      }
      case "o": {
        const links = selectionLinks(elements);
        if (links.length === 0) showToast("No links in the selection");
        else openLinks(links, false);
        this.reset();
        return false;
      }
      case "Shift+O": {
        const links = selectionLinks(elements);
        if (links.length === 0) showToast("No links in the selection");
        else openLinks(links, true);
        this.reset();
        return false;
      }
      case "s": {
        const text = selectionText(elements);
        const engine = this.settings ? defaultEngine(this.settings.searchEngines) : undefined;
        if (text && engine) location.href = engineUrl(engine, text);
        else showToast("Nothing to search");
        this.reset();
        return false;
      }
      default:
        return true;
    }
  }

  // ---- rendering ---------------------------------------------------------

  private matching(prefix: string): number[] {
    const out: number[] = [];
    for (let i = 0; i < this.labels.length; i++) {
      if (this.labels[i].startsWith(prefix)) out.push(i);
    }
    return out;
  }

  private refresh(): void {
    if (!this.overlay) return;
    const visible = new Set<number>(this.selected);
    if (this.typed) {
      for (const i of this.matching(this.typed)) visible.add(i);
    } else {
      for (let i = 0; i < this.labels.length; i++) visible.add(i);
    }
    this.overlay.render(visible, this.typed, this.selected);
  }

  private toggle(index: number): void {
    if (this.selected.has(index)) this.selected.delete(index);
    else this.selected.add(index);
  }

  private buildToolbar(): void {
    const settings = this.settings;
    if (!settings || this.toolbar) return;
    ensureKestrelStyles();
    const theme = themeFor(settings);
    const bar = document.createElement("div");
    // D1: the toolbar is *not* a modal. Using DOM_IDS.visual here made
    // `anyModalOpen()` true for the whole session, swallowing every key —
    // Escape included — so visual mode could only be exited by reloading.
    bar.id = DOM_IDS.visualBar;
    bar.className = "kestrel-overlay";
    bar.setAttribute("role", "status");
    bar.setAttribute("aria-live", "polite");
    Object.assign(bar.style, {
      position: "fixed",
      bottom: "16px",
      left: "50%",
      transform: "translateX(-50%)",
      background: theme.panel,
      color: theme.text,
      border: `1px solid ${theme.border}`,
      borderRadius: "8px",
      padding: "6px 14px",
      font: `600 12px/1.5 ${theme.fontFamily}`,
      pointerEvents: "none",
    } as CSSStyleDeclaration);
    document.documentElement.appendChild(bar);
    this.toolbar = bar;
    this.updateToolbar();
  }

  private updateToolbar(): void {
    if (!this.toolbar) return;
    this.toolbar.textContent =
      this.phase === "selecting"
        ? `Visual: type labels to select · Enter to act · Esc to cancel`
        : `Visual: ${this.selected.size} selected · y copy · Y links · o open · O new tab · s search · Esc`;
  }

  private reset(): void {
    this.active = false;
    this.overlay?.destroy();
    this.overlay = null;
    this.toolbar?.remove();
    this.toolbar = null;
    this.targets = [];
    this.labels = [];
    this.selected = new Set();
    this.typed = "";
    this.phase = "selecting";
    const exit = this.onExit;
    this.onExit = () => undefined;
    exit();
  }
}
