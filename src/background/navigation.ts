import { createLogger } from "../core/logger";

// §3.7: the old `navigateTo` installed a fresh `tabs.onUpdated` listener per
// navigation and removed it only on a successful load — a leak that grew with
// every mark jump. There is now ONE long-lived listener consulting a pending
// map, with timeout and `onRemoved` eviction.

const log = createLogger("navigation");
const SCROLL_DEADLINE_MS = 15_000;

interface PendingScroll {
  x: number;
  y: number;
  expiresAt: number;
}

const pending = new Map<number, PendingScroll>();
let installed = false;

/** Install the single navigation listener. Safe to call more than once. */
export function installNavigationListener(): void {
  if (installed) return;
  installed = true;

  chrome.tabs.onUpdated.addListener((tabId, info) => {
    if (info.status !== "complete") return;
    const entry = pending.get(tabId);
    if (!entry) return;
    pending.delete(tabId);
    if (Date.now() > entry.expiresAt) return;
    void applyScroll(tabId, entry.x, entry.y);
  });

  chrome.tabs.onRemoved.addListener((tabId) => {
    pending.delete(tabId);
  });
}

async function applyScroll(tabId: number, x: number, y: number): Promise<void> {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (...args: unknown[]) => {
        const [sx, sy] = args as [number, number];
        window.scrollTo(sx, sy);
      },
      args: [x, y],
    });
  } catch (err) {
    log.warn("could not restore scroll position", err);
  }
}

/** Navigate the active tab to `url`, restoring (x, y) once it finishes loading. */
export async function navigateAndScroll(
  url: string,
  x: number | undefined,
  y: number | undefined,
): Promise<void> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  if (typeof x === "number" && Number.isFinite(x) && typeof y === "number" && Number.isFinite(y)) {
    pending.set(tab.id, { x, y, expiresAt: Date.now() + SCROLL_DEADLINE_MS });
  }
  await chrome.tabs.update(tab.id, { url });
}
