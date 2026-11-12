import { perfEnd, perfStart } from "../core/perf";
import type { ExtensionSettings, HintTarget } from "../types";
import { setModeBadge, showToast } from "../ui/toast";

import { HintTargetCache } from "./element-finder";
import { assignHintLabels } from "./hint-labels";
import { HintOverlay } from "./hint-overlay";

// The hints session: decides which targets are visible for the typed prefix,
// handles the key command set, and keeps labels anchored while the page moves.
//
// §3.10 the old `feed()` appended every token's lowercased name (so Escape and
// Backspace "worked" by accident and could only cancel). The command set is now
// explicit: Escape/Ctrl+[ cancel, Backspace pops, Enter activates the sole
// match, Shift+F switches to new-tab, printable keys filter.
// §3.6 labels follow scroll/resize via a single rAF-throttled reposition.

export type HintAction = "open" | "openNewTab" | "hover" | "copyUrl";

const PRINTABLE = /^[0-9a-z]$/;

export class HintsController {
  private cache: HintTargetCache | null = null;
  private overlay: HintOverlay | null = null;
  private observer: MutationObserver | null = null;
  private targets: HintTarget[] = [];
  private labels: string[] = [];
  private visible = new Set<number>();
  private typed = "";
  private action: HintAction = "open";
  private settings: ExtensionSettings | null = null;
  private resolver: ((t: HintTarget | null) => void) | null = null;
  private rafId = 0;
  private observerTimer: number | undefined;
  private active = false;

  private readonly onScroll = (): void => this.scheduleReposition();

  /** Start a hint session; resolves with the activated target, or null. */
  async show(action: HintAction, settings: ExtensionSettings): Promise<HintTarget | null> {
    this.cancelIfActive();
    this.settings = settings;
    this.action = action;
    this.typed = "";
    this.active = true;

    perfStart("hints.scan");
    this.cache = new HintTargetCache(document);
    this.targets = this.cache.get({ smartFiltering: settings.hints.smartFiltering });
    perfEnd("hints.scan");
    if (this.targets.length === 0) {
      this.active = false;
      return null;
    }

    this.labels = assignHintLabels(this.targets, {
      chars: settings.hints.chars,
      style: settings.hints.style,
      homeRowPriority: settings.hints.homeRowPriority,
    });

    perfStart("hints.paint");
    this.overlay = new HintOverlay(settings, this.targets, this.labels);
    this.overlay.mount();
    this.recomputeVisible();
    perfEnd("hints.paint");

    this.installTracking();
    setModeBadge("hint", true, settings);

    return new Promise((resolve) => {
      this.resolver = resolve;
    });
  }

  /** Feed a normalized key token. Returns true while the session stays open. */
  feed(token: string): boolean {
    if (!this.active || !this.settings) return false;

    if (token === "Escape" || token === "Ctrl+[" || token === "Meta+[") {
      this.finish(null);
      return false;
    }
    if (token === "Backspace") {
      this.typed = this.typed.slice(0, -1);
      this.refresh();
      return true;
    }
    if (token === "Enter") {
      const sole = this.soleVisible();
      if (sole !== null) {
        this.activateIndex(sole);
        return false;
      }
      return true;
    }
    if (token === "Shift+F") {
      this.action = "openNewTab";
      this.refresh();
      return true;
    }
    if (token === "Shift+H") {
      this.action = "hover";
      this.refresh();
      return true;
    }

    const lower = token.length === 1 ? token.toLowerCase() : token;
    if (PRINTABLE.test(lower)) {
      this.typed += lower;
      const sole = this.refresh();
      if (sole !== null) {
        this.activateIndex(sole);
        return false;
      }
      return true;
    }
    // Unrecognised key: stay open so the user can recover.
    return true;
  }

  /** Cancel the session from outside (e.g. navigation). */
  cancel(): void {
    this.finish(null);
  }

  /** Current typed prefix (test/debug aid). */
  get typedPrefix(): string {
    return this.typed;
  }

  // ---- internals ---------------------------------------------------------

  /** Recompute visibility for the current prefix; returns a sole index or null. */
  private refresh(): number | null {
    this.recomputeVisible();
    return this.soleVisible();
  }

  private recomputeVisible(): void {
    if (!this.settings || !this.targets.length) return;
    const style = this.settings.hints.style;
    const visible = new Set<number>();

    for (let i = 0; i < this.targets.length; i++) {
      if (!this.typed || this.labels[i].startsWith(this.typed)) visible.add(i);
    }

    // "filtered" style additionally matches the element's own text, so typing a
    // fragment of a link ("sign in") narrows to it even without knowing the
    // label (§3.10 / §S3).
    if (style === "filtered" && this.typed && visible.size === 0) {
      const needle = this.typed;
      for (let i = 0; i < this.targets.length; i++) {
        if (this.targets[i].text.toLowerCase().includes(needle)) visible.add(i);
      }
    }

    this.visible = visible;
    this.overlay?.render(visible, this.typed);
  }

  private soleVisible(): number | null {
    if (this.visible.size !== 1) return null;
    for (const i of this.visible) return i;
    return null;
  }

  private activateIndex(index: number): void {
    const target = this.targets[index];
    if (!target) {
      this.finish(null);
      return;
    }
    this.activate(target);
    this.finish(target);
  }

  private activate(target: HintTarget): void {
    const el = target.element as HTMLElement;
    if (this.action === "hover") {
      el.focus?.();
      el.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
      return;
    }
    if (this.action === "openNewTab") {
      const href = resolvedHref(el);
      if (href) {
        window.open(href, "_blank", "noopener");
        return;
      }
      // Non-link control: its own click handler is the only meaningful action.
      el.click();
      return;
    }
    if (this.action === "copyUrl") {
      const href = resolvedHref(el);
      if (href) {
        void navigator.clipboard?.writeText(href);
        showToast(`Copied ${href}`);
      } else {
        const text = el.textContent?.trim() || "";
        if (text) {
          void navigator.clipboard?.writeText(text);
          showToast(`Copied "${text.slice(0, 30)}"`);
        } else {
          showToast("No URL to copy");
        }
      }
      return;
    }
    // Default: element.click() respects SPA handlers, target=_blank, rel,
    // fragments and download links — the plan's §3.10 recommendation.
    el.click();
  }

  private finish(target: HintTarget | null): void {
    if (!this.active) return;
    this.active = false;
    this.uninstallTracking();
    this.overlay?.destroy();
    this.overlay = null;
    this.targets = [];
    this.labels = [];
    this.visible = new Set();
    this.typed = "";
    this.cache = null;
    setModeBadge("normal", false, this.settings ?? undefined);
    const resolve = this.resolver;
    this.resolver = null;
    resolve?.(target);
  }

  private cancelIfActive(): void {
    if (this.active) this.finish(null);
  }

  private installTracking(): void {
    window.addEventListener("scroll", this.onScroll, true);
    window.addEventListener("resize", this.onScroll, true);
    window.visualViewport?.addEventListener("scroll", this.onScroll);
    window.visualViewport?.addEventListener("resize", this.onScroll);
    if (typeof MutationObserver !== "undefined") {
      this.observer = new MutationObserver(() => this.scheduleRescan());
      this.observer.observe(document.documentElement, { childList: true, subtree: true });
    }
  }

  private uninstallTracking(): void {
    window.removeEventListener("scroll", this.onScroll, true);
    window.removeEventListener("resize", this.onScroll, true);
    window.visualViewport?.removeEventListener("scroll", this.onScroll);
    window.visualViewport?.removeEventListener("resize", this.onScroll);
    this.observer?.disconnect();
    this.observer = null;
    if (this.observerTimer) window.clearTimeout(this.observerTimer);
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = 0;
  }

  private scheduleReposition(): void {
    if (this.rafId) return;
    this.rafId = requestAnimationFrame(() => {
      this.rafId = 0;
      // D8: the overlay keeps the filter set and re-culls against live
      // geometry, so targets scrolled into view gain their labels here.
      this.overlay?.reposition();
    });
  }

  /** Debounced DOM-change handler: invalidate the cache for the next session. */
  private scheduleRescan(): void {
    if (this.observerTimer) window.clearTimeout(this.observerTimer);
    this.observerTimer = window.setTimeout(() => {
      this.cache?.bump();
    }, 200);
  }
}

/** The resolved, browser-normalised href of a link-like element, or null. */
function resolvedHref(el: HTMLElement): string | null {
  if (el instanceof HTMLAnchorElement && el.href) {
    if (el.href.startsWith("javascript:")) return null;
    return el.href;
  }
  const anchor = el.closest?.("a[href]") as HTMLAnchorElement | null;
  if (anchor && anchor.href && !anchor.href.startsWith("javascript:")) return anchor.href;
  return null;
}
