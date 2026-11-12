import type {
  OmnibarBookmarkEntry,
  OmnibarHistoryEntry,
  TabEntry,
} from "../core/messages";

// History / bookmark / tab data for the omnibar. Lives in the background because
// `chrome.history` and `chrome.bookmarks` are not exposed to content scripts.

/** Recent history, ordered by the browser. Empty query returns most-visited. */
export async function queryHistory(text: string, max: number): Promise<OmnibarHistoryEntry[]> {
  if (!chrome.history) return [];
  try {
    const items = await chrome.history.search({ text, maxResults: max });
    return items
      .filter((i): i is typeof i & { url: string } => typeof i.url === "string")
      .map((i) => ({
        url: i.url,
        title: i.title ?? i.url,
        lastVisitTime: i.lastVisitTime ?? 0,
        visitCount: i.visitCount ?? 0,
      }));
  } catch {
    return [];
  }
}

/** Bookmarks, either by free-text search or the whole flattened tree. */
export async function queryBookmarks(
  text: string,
  max: number,
): Promise<OmnibarBookmarkEntry[]> {
  if (!chrome.bookmarks) return [];
  try {
    const nodes = text
      ? await chrome.bookmarks.search({ query: text })
      : flatten(await chrome.bookmarks.getTree());
    return nodes
      .filter((n): n is typeof n & { url: string } => typeof n.url === "string")
      .slice(0, max)
      .map((n) => ({
        url: n.url,
        title: n.title ?? n.url,
        dateAdded: n.dateAdded ?? 0,
      }));
  } catch {
    return [];
  }
}

/** All open tabs in the current window, in tab-strip order. */
export async function listTabs(): Promise<TabEntry[]> {
  try {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    return tabs
      .filter((t): t is typeof t & { id: number } => typeof t.id === "number")
      .map((t) => ({
        id: t.id,
        url: t.url ?? t.pendingUrl ?? "",
        title: t.title ?? "",
        active: !!t.active,
        index: t.index ?? 0,
      }));
  } catch {
    return [];
  }
}

export async function activateTab(tabId: number): Promise<void> {
  try {
    const tab = await chrome.tabs.get(tabId);
    await chrome.tabs.update(tabId, { active: true });
    if (tab.windowId != null) {
      await chrome.windows?.update?.(tab.windowId, { focused: true });
    }
  } catch {
    /* tab may have closed */
  }
}

export async function closeTab(tabId: number): Promise<void> {
  try {
    await chrome.tabs.remove(tabId);
  } catch {
    /* already gone */
  }
}

type BookmarkNode = { title?: string; url?: string; dateAdded?: number; children?: BookmarkNode[] };

function flatten(tree: BookmarkNode[]): BookmarkNode[] {
  const out: BookmarkNode[] = [];
  const walk = (nodes: BookmarkNode[]): void => {
    for (const node of nodes) {
      out.push(node);
      if (node.children) walk(node.children);
    }
  };
  walk(tree);
  return out;
}
