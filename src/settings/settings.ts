import { DEFAULT_KEYMAP } from "../commands/defaults";
import type { ExtensionSettings, SearchEngine } from "../types";

export const SETTINGS_VERSION = 2;

export const DEFAULT_SEARCH_ENGINES: SearchEngine[] = [
  { keyword: "g", name: "Google", urlTemplate: "https://www.google.com/search?q=%s" },
  { keyword: "gh", name: "GitHub", urlTemplate: "https://github.com/search?q=%s" },
  { keyword: "w", name: "Wikipedia", urlTemplate: "https://en.wikipedia.org/w/index.php?search=%s" },
  { keyword: "yt", name: "YouTube", urlTemplate: "https://www.youtube.com/results?search_query=%s" },
  { keyword: "ddg", name: "DuckDuckGo", urlTemplate: "https://duckduckgo.com/?q=%s" },
];

export const DEFAULT_SETTINGS: ExtensionSettings = {
  version: SETTINGS_VERSION,
  keymap: DEFAULT_KEYMAP,
  scroll: {
    step: 60,
    halfPageFraction: 0.5,
    fullPageFraction: 1.0,
    smoothDuration: 180,
    acceleration: 1.0,
    respectReducedMotion: true,
  },
  hints: {
    chars: "asdfghjklqwertyuiopzxcvbnm",
    style: "letters",
    homeRowPriority: true,
    smartFiltering: true,
    fontSizeScale: 1.0,
    highContrast: false,
    colorblindSafe: false,
  },
  searchEngines: DEFAULT_SEARCH_ENGINES,
  siteProfiles: [],
  disabledSites: [],
  useBuiltinProfiles: true,
  onboarding: {
    completedTutorial: false,
    seenTips: [],
  },
  debug: {
    enabled: false,
  },
};

/**
 * Merge a stored object onto defaults so newly added keys are populated.
 * Nested groups are merged explicitly; `migrations.ts` runs *before* this to
 * reshape anything older than the current schema.
 */
export function normalizeSettings(raw: Partial<ExtensionSettings> | undefined): ExtensionSettings {
  const base = structuredClone(DEFAULT_SETTINGS);
  if (!raw || typeof raw !== "object") return base;
  return {
    ...base,
    ...raw,
    version: SETTINGS_VERSION,
    keymap: { ...base.keymap, ...(raw.keymap ?? {}) },
    scroll: { ...base.scroll, ...(raw.scroll ?? {}) },
    hints: { ...base.hints, ...(raw.hints ?? {}) },
    onboarding: { ...base.onboarding, ...(raw.onboarding ?? {}) },
    debug: { ...base.debug, ...(raw.debug ?? {}) },
    searchEngines: Array.isArray(raw.searchEngines) ? raw.searchEngines : base.searchEngines,
    siteProfiles: Array.isArray(raw.siteProfiles) ? raw.siteProfiles : [],
    disabledSites: Array.isArray(raw.disabledSites) ? raw.disabledSites : [],
  };
}
