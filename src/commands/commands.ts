import type { CommandDef, CommandName } from "../types";

// Central registry of every command the extension knows about. The default
// keymap lives in ./defaults.ts; the options UI lets users remap any of these.
export const COMMANDS: CommandDef[] = [
  // --- Navigation & scrolling ---
  { name: "scrollDown", label: "Scroll down", category: "navigation", description: "Scroll down by one step." },
  { name: "scrollUp", label: "Scroll up", category: "navigation", description: "Scroll up by one step." },
  { name: "scrollLeft", label: "Scroll left", category: "navigation", description: "Scroll left by one step." },
  { name: "scrollRight", label: "Scroll right", category: "navigation", description: "Scroll right by one step." },
  { name: "scrollToTop", label: "Scroll to top", category: "navigation", description: "Jump to the top of the page (gg)." },
  { name: "scrollToBottom", label: "Scroll to bottom", category: "navigation", description: "Jump to the bottom of the page (G)." },
  { name: "scrollPageDown", label: "Page down (full)", category: "navigation", description: "Scroll down one full page (Ctrl+d)." },
  { name: "scrollPageUp", label: "Page up (full)", category: "navigation", description: "Scroll up one full page (Ctrl+u)." },
  { name: "scrollHalfDown", label: "Page down (half)", category: "navigation", description: "Scroll down half a page (d)." },
  { name: "scrollHalfUp", label: "Page up (half)", category: "navigation", description: "Scroll up half a page (u)." },
  { name: "scrollFullLeft", label: "Scroll all the way left", category: "navigation", description: "Scroll all the way to the left edge (zH)." },
  { name: "scrollFullRight", label: "Scroll all the way right", category: "navigation", description: "Scroll all the way to the right edge (zL)." },
  { name: "urlGoUp", label: "Go up URL hierarchy", category: "navigation", description: "Navigate up one directory level in the URL path (gu)." },
  { name: "urlGoRoot", label: "Go to root URL", category: "navigation", description: "Navigate to the root of the current site (gU)." },

  // --- Link hints ---
  { name: "hintOpen", label: "Open hint link", category: "links", description: "Show hints and open a link in the current tab (f)." },
  { name: "hintOpenNewTab", label: "Open hint link in new tab", category: "links", description: "Show hints and open a link in a new tab (F)." },
  { name: "hintHover", label: "Hover hint element", category: "links", description: "Show hints and hover/focus an element without clicking (;f)." },
  { name: "hintCopy", label: "Copy link URL", category: "links", description: "Show hints and copy a link's URL to the clipboard (yf)." },

  // --- Tab management ---
  { name: "tabNext", label: "Next tab", category: "tabs", description: "Switch to the next tab (J or gt)." },
  { name: "tabPrev", label: "Previous tab", category: "tabs", description: "Switch to the previous tab (K or gT)." },
  { name: "tabClose", label: "Close tab", category: "tabs", description: "Close the current tab (x)." },
  { name: "tabRestore", label: "Restore tab", category: "tabs", description: "Restore the most recently closed tab (X)." },
  { name: "tabNew", label: "New tab", category: "tabs", description: "Open a new tab (t)." },
  { name: "tabSearch", label: "Search open tabs", category: "tabs", description: "Open the tab-search palette (T)." },
  { name: "moveTabLeft", label: "Move tab left", category: "tabs", description: "Move the current tab one position left (<<)." },
  { name: "moveTabRight", label: "Move tab right", category: "tabs", description: "Move the current tab one position right (>>)." },
  { name: "moveTabToNewWindow", label: "Move tab to new window", category: "tabs", description: "Move the current tab to a new window (W)." },
  { name: "duplicateTab", label: "Duplicate tab", category: "tabs", description: "Duplicate the current tab (yd)." },
  { name: "togglePinTab", label: "Pin / unpin tab", category: "tabs", description: "Toggle whether the current tab is pinned (gp)." },

  // --- History, omnibar & bookmarks ---
  { name: "historyBack", label: "History back", category: "navigation", description: "Go back in history (H)." },
  { name: "historyForward", label: "History forward", category: "navigation", description: "Go forward in history (L)." },
  { name: "openOmnibar", label: "Open omnibar", category: "urls", description: "Open URL / history / bookmarks / tabs (o)." },
  { name: "openOmnibarNewTab", label: "Open omnibar in new tab", category: "urls", description: "Open the omnibar and run the result in a new tab (O)." },
  { name: "openBookmarks", label: "Open bookmarks", category: "urls", description: "Search bookmarks in the omnibar (b)." },
  { name: "openBookmarksNewTab", label: "Open bookmarks in new tab", category: "urls", description: "Search bookmarks and open result in a new tab (B)." },

  // --- Marks ---
  { name: "setMark", label: "Set mark", category: "editing", description: "Set a mark at the current scroll position (m).", needsArgument: true, argType: "char" },
  { name: "jumpToMark", label: "Jump to mark", category: "editing", description: "Jump to a previously set mark (').", needsArgument: true, argType: "char" },

  // --- Clipboard & URL basics ---
  { name: "copyUrl", label: "Copy URL", category: "urls", description: "Copy the current URL to the clipboard (yy)." },
  { name: "openClipboard", label: "Open clipboard URL", category: "urls", description: "Open the clipboard contents as a URL in this tab (p)." },
  { name: "openClipboardNewTab", label: "Open clipboard URL in new tab", category: "urls", description: "Open the clipboard contents as a URL in a new tab (P)." },
  { name: "reload", label: "Reload page", category: "navigation", description: "Reload the current page (r)." },
  { name: "hardReload", label: "Hard reload", category: "navigation", description: "Reload bypassing the cache (R)." },
  { name: "focusFirstInput", label: "Focus first input", category: "editing", description: "Focus the first text input on the page (gi)." },
  { name: "focusLastInput", label: "Focus last input", category: "editing", description: "Focus the last text input on the page (ge)." },

  // --- Modes ---
  { name: "enterVisualMode", label: "Visual mode", category: "editing", description: "Enter visual (selection) mode (v)." },
  { name: "enterFindMode", label: "Find mode", category: "misc", description: "In-page incremental find (/)." },
  { name: "enterCommandMode", label: "Command mode", category: "misc", description: "Open the command palette (:)." },
  { name: "enterInsertMode", label: "Enter insert mode", category: "editing", description: "Pass all keys directly to the page until Escape is pressed (i)." },

  // --- Find navigation ---
  { name: "findNext", label: "Next find match", category: "misc", description: "Jump to the next find match (n)." },
  { name: "findPrev", label: "Previous find match", category: "misc", description: "Jump to the previous find match (N)." },

  // --- Misc / UI ---
  { name: "openOptions", label: "Open options", category: "misc", description: "Open the settings page." },
  { name: "showHelp", label: "Help / cheat sheet", category: "misc", description: "Show the categorized, searchable cheat sheet (?)." },
  { name: "openInspector", label: "Debug inspector", category: "misc", description: "Show why the last key did what it did (debug mode only)." },
  { name: "toggleExtension", label: "Toggle on this site", category: "misc", description: "Enable or disable Kestrel for the current site." },
];

/** Exhaustive map: a missing `CommandDef` for a union member is a compile error. */
export const COMMAND_BY_NAME: Record<CommandName, CommandDef> = COMMANDS.reduce(
  (acc, c) => {
    acc[c.name] = c;
    return acc;
  },
  {} as Record<CommandName, CommandDef>,
);

export const COMMAND_CATEGORIES = ["navigation", "tabs", "links", "editing", "urls", "misc"] as const;

export { DEFAULT_KEYMAP, UNBOUND_BY_DESIGN, defaultChords } from "./defaults";
