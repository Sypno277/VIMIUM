import type { KeyChord, KeyEventLike } from "../types";

// Key normalization: turning stored chords and raw keyboard events into the
// single-key tokens the resolver compares. Pure and exhaustively tested.

/** Split a stored chord ("g g", "Shift+F", "Ctrl+d") into single-key tokens. */
export function chordToTokens(chord: KeyChord): string[] {
  return chord.trim().split(/\s+/).filter(Boolean);
}

/**
 * Turn a raw keyboard event into a normalized single-key token that matches the
 * strings used in stored chords. Examples:
 *   key="g"                     -> "g"
 *   key="G" (shift)            -> "Shift+G"
 *   key="f" + shift            -> "Shift+F"
 *   key="d" + ctrl             -> "Ctrl+d"
 *   key="?" (shift+/)          -> "?"   (shifted symbols keep their char)
 *   key=";"                    -> ";"
 */
export function tokenFromEvent(e: KeyEventLike): string {
  const key = e.key;
  if (key === " " || key === "Spacebar") return " ";
  if (e.ctrlKey) return "Ctrl+" + (e.key.length === 1 ? e.key.toLowerCase() : e.key);
  if (e.metaKey) return "Meta+" + (e.key.length === 1 ? e.key.toLowerCase() : e.key);
  if (e.altKey) return "Alt+" + e.key;
  if (e.shiftKey && /^[A-Za-z]$/.test(e.key)) return "Shift+" + e.key;
  return key; // includes "?", "/", ";", "'", "g", "f", etc.
}

/** Validate a user-authored chord: non-empty, no control characters. */
export function isValidChord(chord: string): boolean {
  const tokens = chordToTokens(chord);
  if (tokens.length === 0) return false;
  return tokens.every((t) => t.length > 0 && !/[\n\r\t]/.test(t));
}
