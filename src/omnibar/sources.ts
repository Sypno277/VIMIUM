import type {
  OmnibarBookmarkEntry,
  OmnibarHistoryEntry,
  TabEntry,
} from "../core/messages";
import { requestFromBackground } from "../core/messages";
import type { ExtensionSettings } from "../types";

import { defaultEngine, engineUrl, matchEngine } from "./engines";
import { blendedRank } from "./frecency";
import { fuzzyMatch } from "./fuzzy";

// Data providers + ranking for the omnibar. History/bookmarks/tabs are fetched
// once when the overlay opens (via the background, which owns those API
// permissions) and then filtered locally per keystroke, so typing stays under
// the 8 ms budget the plan sets.

export type OmnibarKind = "url" | "history" | "bookmark" | "tab" | "search";

export interface OmnibarItem {
  kind: OmnibarKind;
  title: string;
  url: string;
  /** Present for open tabs so the item can be focused instead of re-opened. */
  tabId?: number;
  score: number;
  /** Short dimmed line under the title. */
  detail: string;
}

export interface SourceData {
  history: OmnibarHistoryEntry[];
  bookmarks: OmnibarBookmarkEntry[];
  tabs: TabEntry[];
}

export const EMPTY_SOURCES: SourceData = { history: [], bookmarks: [], tabs: [] };

const HISTORY_LIMIT = 200;
const BOOKMARK_LIMIT = 500;

/**
 * Fetch recent history, all bookmarks and all open tabs from the background.
 *
 * D16: `only` restricts the fetch to the scopes the overlay actually renders —
 * tab search used to pull 200 history rows and 500 bookmarks and discard every
 * one of them.
 */
export async function loadSources(
  only: "all" | "tabs" | "bookmarks" = "all",
): Promise<SourceData> {
  if (only === "tabs") {
    const tabs = await requestFromBackground({ type: "tabs:list" });
    return { ...EMPTY_SOURCES, tabs: tabs ?? [] };
  }
  if (only === "bookmarks") {
    const bookmarks = await requestFromBackground({
      type: "bookmarks:query",
      query: "",
      max: BOOKMARK_LIMIT,
    });
    return { ...EMPTY_SOURCES, bookmarks: bookmarks ?? [] };
  }
  const [history, bookmarks, tabs] = await Promise.all([
    requestFromBackground({ type: "history:query", query: "", max: HISTORY_LIMIT }),
    requestFromBackground({ type: "bookmarks:query", query: "", max: BOOKMARK_LIMIT }),
    requestFromBackground({ type: "tabs:list" }),
  ]);
  return {
    history: history ?? [],
    bookmarks: bookmarks ?? [],
    tabs: tabs ?? [],
  };
}

const URL_LIKE =
  /^(https?:\/\/|www\.|localhost|about:|chrome:|\/|[\w-]+\.[a-z]{2,}(\/|$|\?|#))/i;

/** Heuristic: does the typed text already look like a URL (not a search)? */
export function looksLikeUrl(text: string): boolean {
  const t = text.trim();
  if (!t || /\s/.test(t)) return false;
  return URL_LIKE.test(t);
}

/** Turn a bare "example.com" into an absolute URL. */
export function toNavigableUrl(text: string): string {
  const t = text.trim();
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(t) || /^(about|chrome|file):/i.test(t)) return t;
  return "https://" + t;
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function fuzzyRatio(query: string, text: string): number {
  const r = fuzzyMatch(query, text);
  if (!r.matched) return -1;
  return r.score / (r.score + 15);
}

/** Build the ranked, de-duplicated list shown for the current query. */
export function rankItems(
  data: SourceData,
  query: string,
  settings: ExtensionSettings,
  now: number = Date.now(),
): OmnibarItem[] {
  const q = query.trim();
  const items: OmnibarItem[] = [];

  // 1. Direct URL, always first when the text looks like one.
  if (looksLikeUrl(q)) {
    const url = toNavigableUrl(q);
    items.push({ kind: "url", title: url, url, score: 10_000, detail: "Open URL" });
  }

  // 2. Keyword engine (`g foo`) short-circuits everything else.
  const engineMatch = matchEngine(q, settings.searchEngines);
  if (engineMatch) {
    const url = engineUrl(engineMatch.engine, engineMatch.query);
    items.push({
      kind: "search",
      title: `${engineMatch.engine.name}: ${engineMatch.query}`,
      url,
      score: 9_000,
      detail: "Search",
    });
    return items;
  }

  // 3. Open tabs (jump to them instead of re-opening).
  for (const tab of data.tabs) {
    if (!tab.url) continue;
    const ratio = fuzzyRatio(q, `${tab.title} ${tab.url}`);
    if (ratio < 0) continue;
    items.push({
      kind: "tab",
      title: tab.title || tab.url,
      url: tab.url,
      tabId: tab.id,
      score: 800 + ratio * 400 + (tab.active ? 50 : 0),
      detail: "Open tab",
    });
  }

  // 4. Bookmarks and history, de-duplicated by URL (bookmark wins).
  const byUrl = new Map<string, OmnibarItem>();

  for (const bm of data.bookmarks) {
    if (!bm.url) continue;
    const ratio = fuzzyRatio(q, `${bm.title} ${bm.url}`);
    if (ratio < 0) continue;
    byUrl.set(normalizeUrl(bm.url), {
      kind: "bookmark",
      title: bm.title || bm.url,
      url: bm.url,
      score: 600 + ratio * 300,
      detail: "Bookmark",
    });
  }

  for (const h of data.history) {
    if (!h.url) continue;
    const ratio = fuzzyRatio(q, `${h.title} ${h.url}`);
    if (ratio < 0) continue;
    const key = normalizeUrl(h.url);
    if (byUrl.has(key)) continue;
    const rank = blendedRank(
      { lastVisited: h.lastVisitTime, visitCount: h.visitCount },
      ratio,
      { now },
    );
    byUrl.set(key, {
      kind: "history",
      title: h.title || h.url,
      url: h.url,
      score: rank * 100,
      detail: hostOf(h.url),
    });
  }

  items.push(...byUrl.values());

  // 5. Fall back to a plain web search when nothing else matches a non-empty
  //    query and it is not URL-like.
  if (items.length === 0 && q) {
    const engine = defaultEngine(settings.searchEngines);
    if (engine) {
      items.push({
        kind: "search",
        title: `Search ${engine.name}: ${q}`,
        url: engineUrl(engine, q),
        score: 1,
        detail: "Search the web",
      });
    }
  }

  items.sort((a, b) => b.score - a.score);
  return items.slice(0, 50);
}

function normalizeUrl(url: string): string {
  return url.trim().toLowerCase().replace(/#.*$/, "").replace(/\/$/, "");
}
