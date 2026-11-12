import type { CommandName, ExtensionSettings, KeyChord } from "../types";

// A real Vimium `Custom key mappings` parser. The previous UI button advertised
// a parser that did not exist (§3.16); this one handles the lines users
// actually paste and reports exactly what it did.

type Keymap = Partial<Record<CommandName, KeyChord[]>>;

export interface SkippedLine {
  line: string;
  reason: string;
}

export interface VimiumImportResult {
  keymap: Keymap;
  imported: number;
  skipped: SkippedLine[];
  /** Vimium command names we do not have an equivalent for. */
  unsupportedCommands: string[];
}

/** Vimium command -> our command. Absent names are "unsupported". */
const COMMAND_MAP: Record<string, CommandName> = {
  scrollDown: "scrollDown",
  scrollUp: "scrollUp",
  scrollLeft: "scrollLeft",
  scrollRight: "scrollRight",
  scrollToTop: "scrollToTop",
  scrollToBottom: "scrollToBottom",
  scrollPageDown: "scrollPageDown",
  scrollPageUp: "scrollPageUp",
  scrollFullPageDown: "scrollPageDown",
  scrollFullPageUp: "scrollPageUp",
  scrollToLeft: "scrollFullLeft",
  scrollToRight: "scrollFullRight",
  goBack: "historyBack",
  goForward: "historyForward",
  reload: "reload",
  hardReload: "hardReload",
  copyCurrentUrl: "copyUrl",
  "LinkHints.activateMode": "hintOpen",
  "LinkHints.activateModeToOpenInNewTab": "hintOpenNewTab",
  "LinkHints.activateModeToHover": "hintHover",
  "LinkHints.activateModeToCopyLinkUrl": "hintCopy",
  createTab: "tabNew",
  nextTab: "tabNext",
  previousTab: "tabPrev",
  removeTab: "tabClose",
  restoreTab: "tabRestore",
  moveTabLeft: "moveTabLeft",
  moveTabRight: "moveTabRight",
  moveTabToNewWindow: "moveTabToNewWindow",
  duplicateTab: "duplicateTab",
  togglePinTab: "togglePinTab",
  "Vomnibar.activate": "openOmnibar",
  "Vomnibar.activateInNewTab": "openOmnibarNewTab",
  "Vomnibar.activateBookmarks": "openBookmarks",
  "Vomnibar.activateBookmarksInNewTab": "openBookmarksNewTab",
  focusInput: "focusFirstInput",
  enterFindMode: "enterFindMode",
  performFind: "findNext",
  performBackwardsFind: "findPrev",
  enterInsertMode: "enterInsertMode",
  goUp: "urlGoUp",
  goToRootUrl: "urlGoRoot",
  "Marks.activateCreateMode": "setMark",
  "Marks.activateGotoMode": "jumpToMark",
  find: "enterFindMode",
  openCopiedUrlInCurrentTab: "openClipboard",
  openCopiedUrlInNewTab: "openClipboardNewTab",
  enterVisualMode: "enterVisualMode",
};

/**
 * Parse Vimium key syntax into our chord tokens.
 * `gg` -> ["g","g"]; `<c-d>` -> ["Ctrl+d"]; `<a-f>` -> ["Alt+f"];
 * `<s-x>` -> ["Shift+X"]. Returns null for constructs we cannot express.
 */
export function parseVimiumKeys(spec: string): string[] | null {
  const tokens: string[] = [];
  let i = 0;
  while (i < spec.length) {
    if (spec[i] === "<") {
      const close = spec.indexOf(">", i);
      if (close === -1) return null;
      const inner = spec.slice(i + 1, close);
      const token = parseAngleKey(inner);
      if (!token) return null;
      tokens.push(token);
      i = close + 1;
    } else {
      tokens.push(spec[i]);
      i += 1;
    }
  }
  return tokens.length ? tokens : null;
}

function parseAngleKey(inner: string): string | null {
  if (!inner) return null;
  const parts = inner.split("-");
  const base = parts.pop();
  if (!base || base.length !== 1) return null;
  let ctrl = false;
  let alt = false;
  let shift = false;
  let meta = false;
  for (const mod of parts) {
    if (mod === "c" || mod === "ctrl") ctrl = true;
    else if (mod === "a" || mod === "alt") alt = true;
    else if (mod === "s" || mod === "shift") shift = true;
    else if (mod === "m" || mod === "meta") meta = true;
    else return null;
  }
  if (ctrl) return "Ctrl+" + base.toLowerCase();
  if (meta) return "Meta+" + base.toLowerCase();
  if (alt) return "Alt+" + base;
  if (shift && /[a-z]/i.test(base)) return "Shift+" + base.toUpperCase();
  return base;
}

/** Split a chord back into its single-key tokens (needed for `unmap`). */
function chordKey(chord: KeyChord): string {
  return chord.trim();
}

/**
 * Parse a whole Vimium config. `base` is the keymap to start from (defaults);
 * `unmapAll` clears it first. The returned keymap is a new object.
 */
export function parseVimiumConfig(
  text: string,
  base: ExtensionSettings["keymap"] = {},
): VimiumImportResult {
  const keymap: Keymap = { ...base };
  for (const [name, chords] of Object.entries(keymap)) {
    keymap[name as CommandName] = [...(chords ?? [])];
  }

  const skipped: SkippedLine[] = [];
  const unsupported = new Set<string>();
  let imported = 0;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = stripComment(rawLine).trim();
    if (!line) continue;

    const [verb, ...rest] = line.split(/\s+/);
    if (verb === "unmapAll") {
      for (const name of Object.keys(keymap)) delete keymap[name as CommandName];
      continue;
    }
    if (verb === "unmap") {
      const keys = rest[0];
      const tokens = keys ? parseVimiumKeys(keys) : null;
      if (!tokens) {
        skipped.push({ line, reason: "unparseable key" });
        continue;
      }
      removeChord(keymap, tokens.join(" "));
      continue;
    }
    if (verb === "mapKey" || verb === "mapkey") {
      // mapKey remaps a source to a target key. Represent as a two-chord note
      // we cannot honour yet; report it rather than silently dropping it.
      skipped.push({ line, reason: "mapKey is not supported yet" });
      continue;
    }
    if (verb !== "map") {
      skipped.push({ line, reason: `unknown directive '${verb}'` });
      continue;
    }

    const keys = rest[0];
    const commandName = rest[1];
    if (!keys || !commandName) {
      skipped.push({ line, reason: "map needs a key and a command" });
      continue;
    }
    const tokens = parseVimiumKeys(keys);
    if (!tokens) {
      skipped.push({ line, reason: "unparseable key" });
      continue;
    }
    const command = COMMAND_MAP[commandName];
    if (!command) {
      unsupported.add(commandName);
      skipped.push({ line, reason: `no equivalent for '${commandName}'` });
      continue;
    }
    const chord = tokens.join(" ");
    const existing = keymap[command] ?? [];
    if (!existing.some((c) => chordKey(c) === chord)) existing.push(chord);
    keymap[command] = existing;
    imported += 1;
  }

  return { keymap, imported, skipped, unsupportedCommands: [...unsupported] };
}

function stripComment(line: string): string {
  const hash = line.indexOf("#");
  const quote = line.indexOf('"');
  const cut = [hash, quote].filter((n) => n >= 0).sort((a, b) => a - b)[0];
  return cut === undefined ? line : line.slice(0, cut);
}

function removeChord(keymap: Keymap, chord: string): void {
  for (const name of Object.keys(keymap)) {
    const key = name as CommandName;
    const chords = keymap[key];
    if (!chords) continue;
    keymap[key] = chords.filter((c) => chordKey(c) !== chord);
  }
}
