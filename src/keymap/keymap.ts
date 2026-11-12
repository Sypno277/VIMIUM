import { COMMAND_BY_NAME } from "../commands/commands";
import type { CommandName, ExtensionSettings } from "../types";

import { chordToTokens } from "./tokens";

// ---------------------------------------------------------------------------
// Resolver: maps a sequence of key tokens to a command.
// ---------------------------------------------------------------------------

export type ResolveResult =
  | { type: "command"; command: CommandName; needsArgument?: boolean }
  | { type: "pending" }
  | { type: "none" };

export class KeymapResolver {
  /** command -> array of token-sequences (one per stored chord). */
  private entries: { command: CommandName; tokens: string[] }[] = [];

  constructor(keymap: ExtensionSettings["keymap"]) {
    this.rebuild(keymap);
  }

  /** Swap the keymap (e.g. after a settings change or site switch). */
  rebuild(keymap: ExtensionSettings["keymap"]): void {
    this.entries = [];
    for (const [name, chords] of Object.entries(keymap)) {
      for (const chord of chords ?? []) {
        const tokens = chordToTokens(chord);
        if (tokens.length) {
          this.entries.push({ command: name as CommandName, tokens });
        }
      }
    }
  }

  /** Feed a single normalized key token and resolve the current sequence. */
  feed(token: string, buffer: string[]): ResolveResult {
    buffer.push(token);
    const joined = buffer;

    // Exact matches take priority.
    const exact = this.entries.filter((e) => seqEqual(e.tokens, joined));
    if (exact.length) {
      const cmd = exact[0].command;
      buffer.length = 0;
      const def = COMMAND_BY_NAME[cmd];
      return { type: "command", command: cmd, needsArgument: def?.needsArgument };
    }

    // Still a strict prefix of at least one binding -> wait for more keys.
    const isPrefix = this.entries.some(
      (e) => e.tokens.length > joined.length && seqStartsWith(e.tokens, joined),
    );
    if (isPrefix) return { type: "pending" };

    // No match and not a prefix -> reset.
    buffer.length = 0;
    return { type: "none" };
  }
}

function seqEqual(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((t, i) => t === b[i]);
}

function seqStartsWith(a: string[], b: string[]): boolean {
  return b.every((t, i) => a[i] === t);
}

// Re-export the split modules so existing importers keep working.
export { chordToTokens, tokenFromEvent, isValidChord } from "./tokens";
export { findConflicts, findPrefixShadows } from "./conflicts";
export type { KeymapConflict } from "./conflicts";
