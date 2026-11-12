import type { ExtensionSettings } from "../types";
import { prefersReducedMotion } from "../ui/styles";

// Scroll engine as an instance (not module-global mutable state, §3.11), aware
// of the nearest scrollable **container** rather than only `window`. Every
// scroll path resolves the real target, clamps to the remaining distance, and
// shares one acceleration ramp so `j/k`, `d/u` and `gg/G` behave consistently.
//
// D7: `scrollPage` no longer multiplies by `scroll.acceleration` (that setting
//     is a key-repeat ramp cap, not a page-height multiplier), and the page
//     fractions come from settings instead of being hard-coded in dispatch.
// D15: the scroll target is resolved once per gesture and reused for the edge
//     check and the scroll itself, so `getComputedStyle` is not re-run two or
//     three times inside a single keypress.

export interface ScrollTarget {
  /** The scrollable element, or null to mean the window/document. */
  el: Element | null;
  /** Maximum scroll offset (scrollHeight - clientHeight). */
  max: number;
}

export type Direction = "down" | "up" | "left" | "right";
export type Edge = "top" | "bottom" | "left" | "right";

const SCROLLABLE = /(auto|scroll|overlay)/;

/** How long a resolved target is reused before it is re-resolved (D15). */
const GESTURE_WINDOW_MS = 400;

/** Is `el` itself a scroll container with room to scroll? */
function isScrollable(el: Element): boolean {
  // Cheap numeric check first: a container with nothing to scroll cannot be the
  // target, and `getComputedStyle` is the most expensive call on this path.
  if (el.scrollHeight - el.clientHeight <= 1) return false;
  const s = getComputedStyle(el);
  return SCROLLABLE.test(s.overflowY + s.overflowX);
}

/**
 * Resolve the element that should scroll, starting from the focused element
 * (so `j` inside a modal scrolls the modal) and falling back to the document.
 */
export function resolveScrollTarget(from: Element | null): ScrollTarget {
  let node: Element | null = from;
  while (node && node !== document.body && node !== document.documentElement) {
    if (isScrollable(node)) {
      return { el: node, max: Math.max(0, node.scrollHeight - node.clientHeight) };
    }
    node = node.parentElement;
  }
  const doc = document.scrollingElement ?? document.documentElement;
  return { el: null, max: Math.max(0, doc.scrollHeight - window.innerHeight) };
}

interface ScrollState {
  accel: number;
  lastDir: number;
  lastTime: number;
}

const ACCEL_WINDOW_MS = 400;

function dirCode(d: Direction): number {
  return d === "down" ? 1 : d === "up" ? -1 : d === "left" ? -2 : 2;
}

export class ScrollEngine {
  private state: ScrollState = { accel: 0, lastDir: 0, lastTime: 0 };
  private cachedTarget: ScrollTarget | null = null;
  private cachedAt = 0;

  /** Reset the acceleration ramp and the cached target (e.g. on mode change). */
  reset(): void {
    this.state = { accel: 0, lastDir: 0, lastTime: 0 };
    this.cachedTarget = null;
  }

  scrollStep(dir: Direction, settings: ExtensionSettings): void {
    const target = this.target();
    const step = this.ramp(dir, settings);
    if (step <= 0) return;

    if (dir === "left" || dir === "right") {
      const current = this.currentX(target);
      const remaining = dir === "right" ? this.maxX(target) - current : current;
      if (remaining <= 0) return;
      const delta = Math.min(step, remaining);
      this.apply(target, dir === "right" ? delta : -delta, 0, settings);
      return;
    }

    const current = this.currentY(target);
    const remaining = dir === "down" ? target.max - current : current;
    if (remaining <= 0) return;
    const delta = Math.min(step, remaining);
    this.apply(target, 0, dir === "down" ? delta : -delta, settings);
  }

  /**
   * Scroll by a viewport fraction. Positive scrolls down, negative up. The
   * fraction is supplied by the caller so `halfPageFraction` and
   * `fullPageFraction` are honoured (D7).
   */
  scrollPage(fraction: number, settings: ExtensionSettings): void {
    const target = this.target();
    const viewport = target.el ? (target.el as HTMLElement).clientHeight : window.innerHeight;
    this.apply(target, 0, viewport * fraction, settings);
  }

  scrollToEdge(edge: Edge, settings: ExtensionSettings): void {
    const target = this.target();
    if (edge === "left" || edge === "right") {
      const destX = edge === "left" ? 0 : this.maxX(target);
      this.scrollAbsolute(target, destX, null);
      return;
    }
    const destination = edge === "top" ? 0 : target.max;
    if (this.reducedMotion(settings)) {
      this.scrollAbsolute(target, null, destination);
      return;
    }
    this.animateTo(target, destination, settings.scroll.smoothDuration * 2);
  }

  /** Scroll by (dx, dy), clamped to the target's remaining distance. */
  scrollBy(dx: number, dy: number, settings: ExtensionSettings): void {
    this.apply(this.target(), dx, dy, settings);
  }

  // ---- target & geometry -------------------------------------------------

  /** Resolve (and cache for the duration of a gesture) the scroll target. */
  private target(): ScrollTarget {
    const now = performance.now();
    if (this.cachedTarget && now - this.cachedAt < GESTURE_WINDOW_MS) {
      return this.cachedTarget;
    }
    this.cachedTarget = resolveScrollTarget(document.activeElement);
    this.cachedAt = now;
    return this.cachedTarget;
  }

  private currentY(target: ScrollTarget): number {
    return target.el ? target.el.scrollTop : window.scrollY;
  }

  private currentX(target: ScrollTarget): number {
    return target.el ? target.el.scrollLeft : window.scrollX;
  }

  private maxX(target: ScrollTarget): number {
    const doc = document.scrollingElement ?? document.documentElement;
    return target.el
      ? Math.max(0, target.el.scrollWidth - target.el.clientWidth)
      : Math.max(0, doc.scrollWidth - window.innerWidth);
  }

  private reducedMotion(settings: ExtensionSettings): boolean {
    return settings.scroll.respectReducedMotion && prefersReducedMotion();
  }

  // ---- acceleration ------------------------------------------------------

  private ramp(dir: Direction, settings: ExtensionSettings): number {
    const { step, acceleration } = settings.scroll;
    const now = performance.now();
    const code = dirCode(dir);
    if (this.state.lastDir === code && now - this.state.lastTime < ACCEL_WINDOW_MS) {
      this.state.accel = Math.min(this.state.accel + step * 0.25, step * acceleration * 4);
    } else {
      this.state.accel = step;
    }
    this.state.lastDir = code;
    this.state.lastTime = now;
    return this.state.accel;
  }

  // ---- writes ------------------------------------------------------------

  /** Apply a relative scroll to an already-resolved target, clamped. */
  private apply(
    target: ScrollTarget,
    dx: number,
    dy: number,
    settings: ExtensionSettings,
  ): void {
    if (target.el) {
      const el = target.el;
      const nextY = clamp(el.scrollTop + dy, 0, target.max);
      const nextX = clamp(el.scrollLeft + dx, 0, this.maxX(target));
      if (this.reducedMotion(settings)) {
        el.scrollTop = nextY;
        el.scrollLeft = nextX;
        return;
      }
      this.animateWithin(el, nextX, nextY, settings.scroll.smoothDuration);
      return;
    }
    const nextY = clamp(window.scrollY + dy, 0, target.max);
    const nextX = clamp(window.scrollX + dx, 0, this.maxX(target));
    if (this.reducedMotion(settings)) {
      window.scrollTo(nextX, nextY);
      return;
    }
    this.animateWindow(nextX, nextY, settings.scroll.smoothDuration);
  }

  /** Jump to an absolute position on one axis (the other axis is untouched). */
  private scrollAbsolute(target: ScrollTarget, x: number | null, y: number | null): void {
    if (target.el) {
      if (x !== null) target.el.scrollLeft = x;
      if (y !== null) target.el.scrollTop = y;
      return;
    }
    window.scrollTo(x ?? window.scrollX, y ?? window.scrollY);
  }

  // ---- animation ---------------------------------------------------------

  private animateWindow(x: number, y: number, duration: number): void {
    const startX = window.scrollX;
    const startY = window.scrollY;
    this.animate(duration, (t) => {
      window.scrollTo(startX + (x - startX) * t, startY + (y - startY) * t);
    });
  }

  private animateWithin(el: Element, x: number, y: number, duration: number): void {
    const startX = el.scrollLeft;
    const startY = el.scrollTop;
    this.animate(duration, (t) => {
      el.scrollLeft = startX + (x - startX) * t;
      el.scrollTop = startY + (y - startY) * t;
    });
  }

  private animateTo(target: ScrollTarget, destination: number, duration: number): void {
    if (target.el) {
      const el = target.el;
      const start = el.scrollTop;
      this.animate(duration, (t) => {
        el.scrollTop = start + (destination - start) * t;
      });
      return;
    }
    const start = window.scrollY;
    this.animate(duration, (t) => {
      window.scrollTo(0, start + (destination - start) * t);
    });
  }

  private animate(duration: number, paint: (eased: number) => void): void {
    const start = performance.now();
    const step = (now: number): void => {
      const t = Math.min(1, (now - start) / Math.max(1, duration));
      paint(easeOutCubic(t));
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}
