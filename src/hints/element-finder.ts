import type { HintTarget } from "../types";

// Recursively scans the DOM for actionable elements, piercing *open* shadow
// roots. Closed shadow roots are undetectable by design.
//
// §3.9: the old pairwise containment guard preferred the *larger* element and
// could add an ancestor as a duplicate. Nesting is now resolved in one ordered
// pass that keeps the deepest control.
// §3.19: results are cached against a DOM revision counter so `f` does not
// re-enumerate a heavy document on every press.

const CLICKABLE_SELECTOR = [
  "a[href]",
  "area[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type=hidden])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "summary",
  "[contenteditable='true']",
  "[role='button']",
  "[role='link']",
  "[role='option']",
  "[tabindex]",
  "label",
  "audio[controls]",
  "video[controls]",
].join(",");

const IGNORE_ROLES = new Set([
  "none",
  "presentation",
  "separator",
  "img",
  "listitem",
  "generic",
  "group",
  "navigation",
  "region",
]);

function isVisible(el: Element): boolean {
  const r = el.getBoundingClientRect();
  // Quick reject for elements that have negligible dimensions
  if (r.width < 2 && r.height < 2) {
    return false;
  }
  // D8: no viewport culling here. Scanning the whole document is what lets `f`
  // hint a long page, and the overlay culls at paint time so a label appears
  // as soon as its target scrolls into view.
  const style = getComputedStyle(el);
  if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
    return false;
  }
  return true;
}

function isInteractiveViaRole(el: Element): boolean {
  const role = el.getAttribute("role")?.toLowerCase();
  if (role && IGNORE_ROLES.has(role)) return false;
  if (el.getAttribute("aria-disabled") === "true") return false;
  return true;
}

function depthOf(el: Element): number {
  let d = 0;
  let node: Element | null = el;
  while (node) {
    d += 1;
    node = node.parentElement;
  }
  return d;
}

function visibleText(el: Element): string {
  const raw = el.getAttribute("aria-label") || el.textContent || "";
  return raw.trim().slice(0, 80);
}

/** Heuristic CTA detection, capped so it never lowercases a whole subtree. */
function isPrimaryCta(el: Element): boolean {
  const tag = el.tagName;
  const isButtonLike =
    tag === "BUTTON" || tag === "A" || el.getAttribute("role") === "button";
  if (!isButtonLike) return false;
  const text = (el.textContent || "").slice(0, 80).toLowerCase();
  if (!text) return tag === "BUTTON";
  return [
    "sign in",
    "log in",
    "login",
    "subscribe",
    "buy",
    "add to cart",
    "send",
    "submit",
    "search",
    "continue",
    "next",
  ].some((w) => text.includes(w));
}

export interface FinderOptions {
  smartFiltering?: boolean;
}

interface CandidateEntry {
  el: Element;
  depth: number;
  docOrder: number;
}

/** Find hintable targets within `root`, keeping the deepest of nested controls. */
export function findHintTargets(
  root: Document | ShadowRoot | Element = document,
  opts: FinderOptions = {},
): HintTarget[] {
  const container: ParentNode =
    root instanceof Element ? root : ((root as Document).body ?? (root as Document));
  const rawElements = Array.from(container.querySelectorAll(CLICKABLE_SELECTOR)) as Element[];

  // Compute depth and preserve original document order in a single pass (O(N) instead of O(N log N))
  const candidates: CandidateEntry[] = rawElements.map((el, i) => ({
    el,
    depth: depthOf(el),
    docOrder: i,
  }));

  // Deepest first, so an ancestor of a kept control is dropped rather than the
  // other way round (§3.9).
  candidates.sort((a, b) => b.depth - a.depth);

  const shadowed = new Set<Element>();
  const kept: CandidateEntry[] = [];
  for (const item of candidates) {
    const el = item.el;
    if (shadowed.has(el)) continue;
    if (!isVisible(el)) continue;
    if (opts.smartFiltering !== false && !isInteractiveViaRole(el)) continue;
    kept.push(item);
    let parent = el.parentElement;
    while (parent) {
      shadowed.add(parent);
      parent = parent.parentElement;
    }
  }

  // Restore document order using index instead of expensive compareDocumentPosition (O(N) instead of O(N log N))
  kept.sort((a, b) => a.docOrder - b.docOrder);

  return kept.map((item, i) => ({
    id: String(i),
    element: item.el,
    text: visibleText(item.el),
    isPrimary: isPrimaryCta(item.el),
  }));
}

/** Recursively collect hint targets across open shadow roots. */
export function findHintTargetsDeep(doc: Document, opts: FinderOptions = {}): HintTarget[] {
  const out: HintTarget[] = [];
  const stack: (Document | ShadowRoot)[] = [doc];
  const seen = new Set<Element>();

  while (stack.length) {
    const root = stack.pop()!;
    for (const t of findHintTargets(root, opts)) {
      if (seen.has(t.element)) continue;
      seen.add(t.element);
      out.push(t);
    }
    // Discover shadow hosts efficiently without allocating huge arrays
    if ("createTreeWalker" in root) {
      const walker = (root as Document).createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
      let node = walker.nextNode() as HTMLElement | null;
      while (node) {
        const sr = node.shadowRoot;
        if (sr && sr.mode === "open") stack.push(sr);
        node = walker.nextNode() as HTMLElement | null;
      }
    } else {
      const all = (root as Document | ShadowRoot).querySelectorAll("*");
      all.forEach((el) => {
        const sr = (el as HTMLElement).shadowRoot;
        if (sr && sr.mode === "open") stack.push(sr);
      });
    }
  }
  return out;
}

/**
 * Caches the target list against a monotonically increasing revision counter.
 * The controller bumps the revision whenever a debounced MutationObserver sees
 * a change, so a scan is reused across keystrokes within a hint session.
 */
export class HintTargetCache {
  private targets: HintTarget[] | null = null;
  private revision = 0;
  private cachedRevision = -1;

  constructor(private readonly doc: Document) {}

  /** Invalidate the cache (call from a debounced observer). */
  bump(): void {
    this.revision += 1;
  }

  get(opts: FinderOptions): HintTarget[] {
    if (this.targets && this.cachedRevision === this.revision) return this.targets;
    this.targets = findHintTargetsDeep(this.doc, opts);
    this.cachedRevision = this.revision;
    return this.targets;
  }

  /** Force a rescan on the next `get`. */
  invalidate(): void {
    this.bump();
  }
}
