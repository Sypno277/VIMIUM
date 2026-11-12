// Shared types used across content script, background, and options UI.
// This is the single source of truth for the settings shape and the exhaustive
// `CommandName` union.

export type Mode = "normal" | "insert" | "hint" | "visual" | "find" | "command";

export type KeyChord = string; // e.g. "f", "Shift+F", "Ctrl+d", "m a"

export type CommandName =
  // Navigation & scrolling
  | "scrollDown"
  | "scrollUp"
  | "scrollLeft"
  | "scrollRight"
  | "scrollToTop"
  | "scrollToBottom"
  | "scrollPageDown"
  | "scrollPageUp"
  | "scrollHalfDown"
  | "scrollHalfUp"
  | "scrollFullLeft"
  | "scrollFullRight"
  | "urlGoUp"
  | "urlGoRoot"
  // Link hints
  | "hintOpen"
  | "hintOpenNewTab"
  | "hintHover"
  | "hintCopy"
  // Tab management
  | "tabNext"
  | "tabPrev"
  | "tabClose"
  | "tabRestore"
  | "tabNew"
  | "tabSearch"
  | "moveTabLeft"
  | "moveTabRight"
  | "moveTabToNewWindow"
  | "duplicateTab"
  | "togglePinTab"
  // History, omnibar & bookmarks
  | "historyBack"
  | "historyForward"
  | "openOmnibar"
  | "openOmnibarNewTab"
  | "openBookmarks"
  | "openBookmarksNewTab"
  // Marks
  | "setMark"
  | "jumpToMark"
  // Clipboard & URL basics
  | "copyUrl"
  | "openClipboard"
  | "openClipboardNewTab"
  | "reload"
  | "hardReload"
  | "focusFirstInput"
  | "focusLastInput"
  // Modes
  | "enterVisualMode"
  | "enterFindMode"
  | "enterCommandMode"
  | "enterInsertMode"
  // Find navigation
  | "findNext"
  | "findPrev"
  // Misc / UI
  | "openOptions"
  | "showHelp"
  | "openInspector"
  | "toggleExtension";

export type CommandCategory =
  | "navigation"
  | "tabs"
  | "links"
  | "editing"
  | "urls"
  | "misc";

export interface CommandDef {
  name: CommandName;
  /** Human-readable label, used in help and the key-binding editor. */
  label: string;
  /** Category for grouping in the cheat sheet / command list. */
  category: CommandCategory;
  /** Short description shown in tooltips and command palette. */
  description: string;
  /** Whether the command requires a follow-up key (e.g. setMark needs a letter). */
  needsArgument?: boolean;
  /** Argument arity: "char" for a single key, "chord" for a second key chord. */
  argType?: "char" | "chord";
}

export interface SearchEngine {
  /** The typed keyword that routes to this engine, e.g. "g" or "gh". */
  keyword: string;
  /** Human-readable name shown in the omnibar hint line. */
  name: string;
  /** URL template; `%s` is replaced by the percent-encoded query. */
  urlTemplate: string;
}

export interface ExtensionSettings {
  version: number;
  /** Map of CommandName -> array of key chords (first entry is "primary"). */
  keymap: Partial<Record<CommandName, KeyChord[]>>;
  scroll: {
    /** px per scroll-step for j/k on a fully loaded page. */
    step: number;
    /** Fraction of viewport for d/u (half) and Ctrl+d/u (full). */
    halfPageFraction: number;
    fullPageFraction: number;
    /** Smooth-scroll easing duration in ms. */
    smoothDuration: number;
    /** Scroll acceleration multiplier (1 = linear). */
    acceleration: number;
    /** Respect prefers-reduced-motion. */
    respectReducedMotion: boolean;
  };
  hints: {
    /** Character set used for hint labels. */
    chars: string;
    /** Visual style variant. */
    style: "letters" | "numbers" | "filtered";
    /** Home-row-optimized assignment weights shorter combos to primary CTAs. */
    homeRowPriority: boolean;
    /** Use computed-role detection to exclude decorative elements. */
    smartFiltering: boolean;
    /** Font scale for hint overlays (1 = normal). */
    fontSizeScale: number;
    /** High-contrast theme for low-vision users. */
    highContrast: boolean;
    /** Colorblind-safe palette. */
    colorblindSafe: boolean;
  };
  /** Keyword search engines for the omnibar. */
  searchEngines: SearchEngine[];
  /** Per-site overrides keyed by match pattern (domain or domain+path prefix). */
  siteProfiles: SiteProfile[];
  /** Domains where the extension is fully disabled. */
  disabledSites: string[];
  /** Built-in curated profiles are applied automatically when matching. */
  useBuiltinProfiles: boolean;
  onboarding: {
    completedTutorial: boolean;
    seenTips: string[];
  };
  debug: {
    /** Enables the debug-gated logging, perf marks and the inspector. */
    enabled: boolean;
  };
}

export interface SiteProfile {
  /** Human-readable name. */
  name: string;
  /** Domain match, e.g. "mail.google.com". */
  match: string;
  /** Commands to disable on this site. */
  disabledCommands?: CommandName[];
  /** Per-command override chords for this site. */
  keymapOverrides?: Partial<Record<CommandName, KeyChord[]>>;
  /** Custom flags, e.g. force insert-mode on certain selectors. */
  forceInsertSelectors?: string[];
  /** True for curated built-in profiles (read-only in UI). */
  builtin?: boolean;
}

export interface HintTarget {
  /** Stable id within a hints session. */
  id: string;
  /** The actual DOM element to activate. */
  element: Element;
  /** Visible text to match against in "filtered" style. */
  text: string;
  /** Whether this is a likely primary CTA (for home-row priority). */
  isPrimary?: boolean;
}

export interface KeyEventLike {
  key: string;
  code?: string;
  shiftKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  metaKey: boolean;
}

/** The minimal shape the label generator needs from a target. */
export interface HintTargetLike {
  isPrimary?: boolean;
}

// ---------------------------------------------------------------------------
// Site policy — the single answer to "what applies on this host?"
// ---------------------------------------------------------------------------

/** Why a site is disabled, so the UI can show the exact pattern that matched. */
export interface DisabledMatch {
  pattern: string;
  kind: "disabledSites";
}

export interface SitePolicy {
  /** Built-in profile (if any) followed by matching user profiles, in order. */
  profiles: SiteProfile[];
  /** True when the whole extension is off for this host. */
  isDisabled: boolean;
  /** Populated when `isDisabled` is true. */
  disabledBy?: DisabledMatch;
  /** The keymap after folding every active profile's overrides over the base. */
  keymap: Partial<Record<CommandName, KeyChord[]>>;
  /** True when the given command is disabled by any active profile. */
  isCommandDisabled(command: CommandName): boolean;
}

// ---------------------------------------------------------------------------
// Frames & messages
// ---------------------------------------------------------------------------

/** A hint target reported from a child frame for cross-frame coordination. */
export interface FrameHintReport {
  frameId: number;
  count: number;
  /** True when the child frame has an active hint session awaiting a key. */
  active: boolean;
}
