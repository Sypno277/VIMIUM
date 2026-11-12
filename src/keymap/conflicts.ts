import type { CommandName, ExtensionSettings, KeyChord } from "../types";

import { chordToTokens } from "./tokens";

// Conflict detection used by the options UI and by the commands integrity test.

export interface KeymapConflict {
  chord: KeyChord;
  commands: CommandName[];
}

/** Returns chords bound to more than one command. */
export function findConflicts(keymap: ExtensionSettings["keymap"]): KeymapConflict[] {
  const byChord = new Map<KeyChord, CommandName[]>();
  for (const [name, chords] of Object.entries(keymap)) {
    for (const chord of chords ?? []) {
      const list = byChord.get(chord) ?? [];
      list.push(name as CommandName);
      byChord.set(chord, list);
    }
  }
  const conflicts: KeymapConflict[] = [];
  for (const [chord, commands] of byChord) {
    if (commands.length > 1) conflicts.push({ chord, commands });
  }
  return conflicts;
}

/**
 * Detect *prefix* shadows: a single-key chord that is also the first token of a
 * multi-key chord (e.g. `t` bound and `t x` bound). This is not always a bug —
 * the resolver handles it — but it is worth warning about in the editor.
 */
export function findPrefixShadows(keymap: ExtensionSettings["keymap"]): KeymapConflict[] {
  const single = new Set<KeyChord>();
  const multiByFirst = new Map<string, CommandName[]>();
  for (const [name, chords] of Object.entries(keymap)) {
    for (const chord of chords ?? []) {
      const tokens = chordToTokens(chord);
      if (tokens.length === 1) single.add(chord.trim());
      else if (tokens.length > 1) {
        const first = tokens[0];
        const list = multiByFirst.get(first) ?? [];
        list.push(name as CommandName);
        multiByFirst.set(first, list);
      }
    }
  }
  const shadows: KeymapConflict[] = [];
  for (const [first, commands] of multiByFirst) {
    if (single.has(first)) shadows.push({ chord: first, commands });
  }
  return shadows;
}
