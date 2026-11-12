// Every element id the extension injects into a page lives here, so the
// content-script's key handler and every overlay agree on them and never
// drift. Namespaced `kestrel-*` (the product identity).

export const DOM_IDS = {
  hints: "kestrel-hints",
  hintHud: "kestrel-hints-hud",
  toast: "kestrel-toast",
  modeBadge: "kestrel-mode",
  palette: "kestrel-palette",
  paletteInput: "kestrel-palette-input",
  cheatSheet: "kestrel-help",
  omnibar: "kestrel-omnibar",
  omnibarInput: "kestrel-omnibar-input",
  tabSearch: "kestrel-tabsearch",
  find: "kestrel-find",
  findInput: "kestrel-find-input",
  visual: "kestrel-visual",
  /** The visual-mode *toolbar*. Deliberately NOT a modal id (see D1). */
  visualBar: "kestrel-visual-bar",
  tutorial: "kestrel-tutorial",
  inspector: "kestrel-inspector",
} as const;

export type DomIdKey = keyof typeof DOM_IDS;

/**
 * Ids that identify an overlay which OWNS the keyboard.
 *
 * `visual` must not appear here: visual mode is a *mode*, not a modal — the
 * content controller routes its keys through `ModeMachine`/`VisualController`.
 * Listing it made `anyModalOpen()` swallow every keystroke, including Escape,
 * which locked the user in visual mode with no way out but a page reload (D1).
 */
export const MODAL_IDS: readonly string[] = [
  DOM_IDS.palette,
  DOM_IDS.cheatSheet,
  DOM_IDS.omnibar,
  DOM_IDS.tabSearch,
  DOM_IDS.find,
  DOM_IDS.tutorial,
];

export function isModalId(id: string | null | undefined): boolean {
  return !!id && MODAL_IDS.includes(id);
}

/** True when any Kestrel overlay currently owns the page (keyboard capture). */
export function anyModalOpen(): boolean {
  if (typeof document === "undefined") return false;
  return MODAL_IDS.some((id) => document.getElementById(id) !== null);
}
