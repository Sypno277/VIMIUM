import type { ExtensionSettings } from "../types";
import { DOM_IDS } from "../ui/dom-ids";
import { Modal } from "../ui/modal";
import { prefersReducedMotion } from "../ui/styles";

// In-page incremental find (`/`), replacing the old no-op that sent a message
// the background had no handler for (§3.2). Highlights are painted as an
// overlay of rectangles derived from each match's Range, so the page DOM is
// never mutated (no injected <mark>, no site breakage) and it works on every
// browser the manifest supports.
//
// D2: `dispose()` is idempotent and always removes both window listeners; the
//     content controller calls it from `onDismiss`, so a closed session can no
//     longer paint a detached layer on every later scroll.
// D3: the current match index survives across sessions, keyed by query, so
//     `n` resumes from the last match visited instead of restarting at 0.
// D17: highlight boxes are pooled and repositioned instead of being destroyed
//     and recreated on every scroll frame.

const MAX_MATCHES = 2000;
const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "INPUT", "SELECT"]);

/** Query -> last visited match index (bounded, most-recent-wins). */
const lastIndexByQuery = new Map<string, number>();
const MAX_REMEMBERED_QUERIES = 20;

function rememberIndex(query: string, index: number): void {
  if (!query) return;
  lastIndexByQuery.delete(query);
  lastIndexByQuery.set(query, index);
  while (lastIndexByQuery.size > MAX_REMEMBERED_QUERIES) {
    const oldest = lastIndexByQuery.keys().next();
    if (oldest.done) break;
    lastIndexByQuery.delete(oldest.value);
  }
}

function recallIndex(query: string): number {
  return lastIndexByQuery.get(query) ?? -1;
}

export class FindController extends Modal {
  private readonly input: HTMLInputElement;
  private readonly counter: HTMLElement;
  private readonly layer: HTMLElement;
  private readonly settings: ExtensionSettings;
  /** Pooled highlight boxes; `painted` is how many are currently in use. */
  private readonly boxes: HTMLElement[] = [];
  private ranges: Range[] = [];
  private current = -1;
  private rafId = 0;
  private disposed = false;

  private readonly onScroll = (): void => this.schedulePaint();

  constructor(settings: ExtensionSettings, onClose: () => void) {
    super(
      { id: DOM_IDS.find, ariaLabel: "Find in page", onDismiss: onClose, backdrop: false },
      settings,
    );
    this.settings = settings;

    // The find bar is non-modal: the root must not swallow page interaction.
    this.root.style.pointerEvents = "none";
    this.root.style.display = "block";

    this.layer = document.createElement("div");
    Object.assign(this.layer.style, {
      position: "fixed",
      inset: "0",
      pointerEvents: "none",
      zIndex: "2147483644",
    } as CSSStyleDeclaration);
    this.root.appendChild(this.layer);

    this.panel.style.position = "fixed";
    this.panel.style.right = "20px";
    this.panel.style.bottom = "20px";
    this.panel.style.margin = "0";
    this.panel.style.pointerEvents = "auto";
    this.panel.style.display = "flex";
    this.panel.style.alignItems = "center";
    this.panel.style.gap = "8px";
    this.panel.style.padding = "6px 8px";

    this.input = document.createElement("input");
    this.input.id = DOM_IDS.findInput;
    this.input.className = "kestrel-input";
    this.input.type = "text";
    this.input.style.width = "220px";
    this.input.style.padding = "6px 8px";
    this.input.placeholder = "Find in page…";
    this.input.setAttribute("aria-label", "Find in page");
    this.input.setAttribute("data-autofocus", "true");
    this.input.addEventListener("input", () => this.run(false));
    this.input.addEventListener("keydown", (e) => this.onKey(e));

    this.counter = document.createElement("span");
    this.counter.className = "kestrel-muted";
    this.counter.setAttribute("role", "status");
    this.counter.setAttribute("aria-live", "polite");
    this.counter.style.minWidth = "64px";
    this.counter.style.textAlign = "right";
    this.counter.style.fontSize = "12px";

    this.panel.append(this.input, this.counter);
    this.focusFirst();
    window.addEventListener("scroll", this.onScroll, true);
    window.addEventListener("resize", this.onScroll, true);
  }

  /** The active search text in the input. */
  get query(): string {
    return this.input.value;
  }

  /** The zero-based index of the highlighted match (-1 when none). */
  get currentIndex(): number {
    return this.current;
  }

  /** Number of matches for the current query. */
  get matchCount(): number {
    return this.ranges.length;
  }

  /**
   * Seed the input and search. `restore` re-selects the match index that was
   * current last time this query was searched, so `n` resumes rather than
   * restarting (D3).
   */
  prefill(text: string): void {
    if (!text) return;
    this.input.value = text;
    this.current = recallIndex(text);
    this.search();
  }

  /** Step the current match by `delta` (used by n/N from normal mode). */
  step(delta: 1 | -1): void {
    if (this.ranges.length === 0) return;
    const base = this.current < 0 ? (delta === 1 ? -1 : 0) : this.current;
    this.current = (base + delta + this.ranges.length) % this.ranges.length;
    rememberIndex(this.query, this.current);
    this.paint();
    this.scrollCurrentIntoView();
  }

  /** Run/refresh the search. `forward` advances to the next match. */
  run(forward: boolean): void {
    const query = this.input.value;
    if (!query) {
      this.ranges = [];
      this.current = -1;
      this.paint();
      return;
    }
    this.search();
    if (forward && this.ranges.length) {
      this.current = (this.current + 1) % this.ranges.length;
    }
    rememberIndex(query, this.current);
    this.paint();
    this.scrollCurrentIntoView();
  }

  /**
   * Dismiss and stop tracking. Idempotent: the content controller calls this
   * from `onDismiss`, and `Modal.dismiss()` may also fire from Escape.
   */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    window.removeEventListener("scroll", this.onScroll, true);
    window.removeEventListener("resize", this.onScroll, true);
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = 0;
    this.layer.replaceChildren();
    this.boxes.length = 0;
    // Route through `dismiss()` so the owner's callback runs exactly once even
    // when disposal is driven from outside (not by Escape/backdrop).
    this.dismiss();
  }

  // ---- internals ---------------------------------------------------------

  /** Recompute matches, preserving the current index when it is still valid. */
  private search(): void {
    const query = this.input.value;
    this.ranges = collectMatches(document.body, query);
    if (this.ranges.length === 0) {
      this.current = -1;
    } else if (this.current < 0) {
      this.current = 0;
    } else if (this.current >= this.ranges.length) {
      this.current = 0;
    }
    this.paint();
    this.scrollCurrentIntoView();
  }

  private onKey(e: KeyboardEvent): void {
    if (e.key === "Enter") {
      e.preventDefault();
      this.step(e.shiftKey ? -1 : 1);
      return;
    }
    if (e.key === "F3") {
      e.preventDefault();
      this.step(e.shiftKey ? -1 : 1);
    }
  }

  /** Paint match rectangles, reusing box elements from the pool (D17). */
  private paint(): void {
    const reduced = this.settings.scroll.respectReducedMotion && prefersReducedMotion();
    let used = 0;

    for (let i = 0; i < this.ranges.length; i++) {
      const isCurrent = i === this.current;
      const background = isCurrent ? "#f59e0b" : "#fbbf24";
      const opacity = isCurrent ? "0.55" : "0.28";
      const rects = this.ranges[i].getClientRects();
      if (!rects) continue;
      for (const rect of rects) {
        if (rect.width === 0 || rect.height === 0) continue;
        const box = this.boxAt(used++);
        box.style.display = "block";
        box.style.left = `${rect.left}px`;
        box.style.top = `${rect.top}px`;
        box.style.width = `${rect.width}px`;
        box.style.height = `${rect.height}px`;
        box.style.background = background;
        box.style.opacity = opacity;
        box.style.transition = reduced ? "none" : "background 0.1s";
      }
    }

    for (let i = used; i < this.boxes.length; i++) {
      this.boxes[i].style.display = "none";
    }

    if (!this.input.value) this.counter.textContent = "";
    else if (this.ranges.length === 0) this.counter.textContent = "0/0";
    else this.counter.textContent = `${this.current + 1}/${this.ranges.length}`;
  }

  /** Get (creating on demand) the pooled box at `index`. */
  private boxAt(index: number): HTMLElement {
    const existing = this.boxes[index];
    if (existing) return existing;
    const box = document.createElement("div");
    Object.assign(box.style, {
      position: "fixed",
      borderRadius: "2px",
      pointerEvents: "none",
    } as CSSStyleDeclaration);
    this.layer.appendChild(box);
    this.boxes[index] = box;
    return box;
  }

  private schedulePaint(): void {
    if (this.rafId || this.disposed) return;
    this.rafId = requestAnimationFrame(() => {
      this.rafId = 0;
      this.paint();
    });
  }

  private scrollCurrentIntoView(): void {
    const range = this.ranges[this.current];
    if (!range) return;
    const start = range.startContainer;
    const el = start instanceof Element ? start : start.parentElement;
    if (!el) return;
    const reduced = this.settings.scroll.respectReducedMotion && prefersReducedMotion();
    el.scrollIntoView({ block: "center", behavior: reduced ? "auto" : "smooth" });
  }
}

/** Collect case-insensitive substring matches across visible text nodes. */
export function collectMatches(root: Node | null, query: string): Range[] {
  if (!root || !query) return [];
  const needle = query.toLowerCase();
  const ranges: Range[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node: Node): number {
      const parent = (node as Text).parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      if (SKIP_TAGS.has(parent.tagName)) return NodeFilter.FILTER_REJECT;
      if (!(node as Text).data.trim()) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  let node = walker.nextNode();
  while (node && ranges.length < MAX_MATCHES) {
    const text = (node as Text).data.toLowerCase();
    let from = 0;
    let idx = text.indexOf(needle, from);
    while (idx !== -1 && ranges.length < MAX_MATCHES) {
      const range = document.createRange();
      range.setStart(node, idx);
      range.setEnd(node, idx + needle.length);
      ranges.push(range);
      from = idx + needle.length;
      idx = text.indexOf(needle, from);
    }
    node = walker.nextNode();
  }
  return ranges;
}
