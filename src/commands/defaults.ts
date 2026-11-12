import type { CommandName, ExtensionSettings, KeyChord } from "../types";

// Default key chords. Mirrors Vimium's defaults for a smooth switcher
// experience, minus any binding that would send the user somewhere they did
// not ask for (see UNBOUND_BY_DESIGN below).
export const DEFAULT_KEYMAP: ExtensionSettings["keymap"] = {
  // Scrolling
  scrollDown: ["j"],
  scrollUp: ["k"],
  scrollLeft: ["h"],
  scrollRight: ["l"],
  scrollToTop: ["g g"],
  scrollToBottom: ["Shift+G"],
  scrollPageDown: ["Ctrl+d"],
  scrollPageUp: ["Ctrl+u"],
  scrollHalfDown: ["d"],
  scrollHalfUp: ["u"],
  scrollFullLeft: ["z Shift+H"],
  scrollFullRight: ["z Shift+L"],
  urlGoUp: ["g u"],
  urlGoRoot: ["g U"],
  // Hints
  hintOpen: ["f"],
  hintOpenNewTab: ["Shift+F"],
  hintHover: ["; f"],
  hintCopy: ["y f"],
  // Tabs
  tabNext: ["Shift+J", "g t"],
  tabPrev: ["Shift+K", "g T"],
  tabClose: ["x"],
  tabRestore: ["Shift+X"],
  tabNew: ["t"],
  tabSearch: ["Shift+T"],
  moveTabLeft: ["< <"],
  moveTabRight: ["> >"],
  moveTabToNewWindow: ["Shift+W"],
  duplicateTab: ["y d"],
  togglePinTab: ["g p"],
  // History, omnibar & bookmarks
  historyBack: ["Shift+H"],
  historyForward: ["Shift+L"],
  openOmnibar: ["o"],
  openOmnibarNewTab: ["Shift+O"],
  openBookmarks: ["b"],
  openBookmarksNewTab: ["Shift+B"],
  // Marks
  setMark: ["m"],
  jumpToMark: ["'"],
  // Clipboard & URL
  copyUrl: ["y y"],
  openClipboard: ["p"],
  openClipboardNewTab: ["Shift+P"],
  reload: ["r"],
  hardReload: ["Shift+R"],
  focusFirstInput: ["g i"],
  focusLastInput: ["g e"],
  // Modes
  enterVisualMode: ["v"],
  enterFindMode: ["/"],
  enterCommandMode: [":"],
  enterInsertMode: ["i"],
  // Find navigation
  findNext: ["n"],
  findPrev: ["Shift+N"],
  // Misc
  showHelp: ["?"],
};

/**
 * Commands that are intentionally reachable **without** a default key. The
 * commands test asserts every `CommandName` is either bound above or listed
 * here with a reason — so a forgotten binding is a test failure, and a
 * deliberate omission is a documented decision rather than an accident.
 */
export const UNBOUND_BY_DESIGN: Partial<Record<CommandName, string>> = {
  openOptions:
    "Would navigate the user away from the page they are on. Reachable from the command palette (`:`).",
  openInspector:
    "Debug-only overlay, toggled from Settings → Accessibility. Not a daily-use key.",
  toggleExtension:
    "A browser-level command (toolbar action / Alt+Shift+X), not a page keypress.",
};

/** A flat list of every chord the default keymap uses (for tests). */
export function defaultChords(): KeyChord[] {
  const out: KeyChord[] = [];
  for (const chords of Object.values(DEFAULT_KEYMAP)) {
    for (const c of chords ?? []) out.push(c);
  }
  return out;
}
