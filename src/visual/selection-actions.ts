// Pure helpers for visual mode: turn a set of selected elements into text /
// links and perform the clipboard/open actions. Kept free of DOM overlay code
// so they can be unit tested without a browser.

/** The visible text of a single element, trimmed and collapsed. */
export function elementText(el: Element): string {
  const raw = el.getAttribute?.("aria-label") || el.textContent || "";
  return raw.replace(/\s+/g, " ").trim();
}

/** Join the text of every selected element with newlines. */
export function selectionText(elements: Element[]): string {
  return elements
    .map(elementText)
    .filter((t) => t.length > 0)
    .join("\n");
}

/** The resolved URL of an element, whether it is a link or wraps one. */
export function elementHref(el: Element): string | null {
  const anchor =
    el instanceof HTMLAnchorElement
      ? el
      : (el.closest?.("a[href]") as HTMLAnchorElement | null);
  if (!anchor?.href) return null;
  if (anchor.href.startsWith("javascript:")) return null;
  return anchor.href;
}

/** The de-duplicated, order-preserving list of link URLs in a selection. */
export function selectionLinks(elements: Element[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const el of elements) {
    const href = elementHref(el);
    if (href && !seen.has(href)) {
      seen.add(href);
      out.push(href);
    }
  }
  return out;
}

/** Copy text to the clipboard. Returns false when the API is unavailable. */
export async function copyText(text: string): Promise<boolean> {
  if (!text) return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Open every URL, either in new tabs or by navigating the current one. */
export function openLinks(urls: string[], newTab: boolean): void {
  if (urls.length === 0) return;
  if (newTab) {
    for (const url of urls) window.open(url, "_blank", "noopener");
    return;
  }
  location.href = urls[0];
}
