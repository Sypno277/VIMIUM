import type { CommandName, ExtensionSettings } from "../types";

// Turns the palette's raw text into a command plus an argument, so `:` becomes
// a command *line* rather than a read-only menu (the §3.1 complaint plus
// §3.22.9's "configurable commands").

export interface CommandLine {
  command?: CommandName;
  /** The raw text as typed (without the leading `:`). */
  raw: string;
  /** The argument, when the command takes one. */
  args?: string;
}

const URL_LIKE = /^(https?:\/\/|www\.|localhost|[\w-]+\.[a-z]{2,}(\/|$))/i;

/** Does the text look like something we should treat as a URL/search? */
export function looksLikeUrlOrQuery(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  return URL_LIKE.test(t) || /\s/.test(t);
}

/**
 * Resolve a command line. Explicit verbs win; a bare URL/search falls through
 * to the omnibar; anything else is left for fuzzy command matching by the
 * caller (returns no `command`).
 */
export function resolveCommandLine(
  input: string,
  _settings: ExtensionSettings,
): CommandLine {
  const raw = input.replace(/^:/, "").trim();
  if (!raw) return { raw };

  const firstSpace = raw.indexOf(" ");
  const verb = (firstSpace === -1 ? raw : raw.slice(0, firstSpace)).toLowerCase();
  const rest = firstSpace === -1 ? "" : raw.slice(firstSpace + 1).trim();

  switch (verb) {
    case "open":
      return { command: "openOmnibar", raw, args: rest || undefined };
    case "tabopen":
    case "tabnew":
    case "topen":
      return { command: "openOmnibarNewTab", raw, args: rest || undefined };
    case "bookmarks":
    case "bm":
      return { command: "openBookmarks", raw, args: rest || undefined };
    case "find":
      return { command: "enterFindMode", raw, args: rest || undefined };
    default:
      break;
  }

  // No recognised verb: a bare URL or query goes to the omnibar.
  if (looksLikeUrlOrQuery(raw)) {
    return { command: "openOmnibar", raw, args: raw };
  }
  return { raw };
}
