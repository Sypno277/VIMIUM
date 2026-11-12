// Lightweight subsequence fuzzy matcher with a score, used for command
// autocomplete, tab search, and the cheat sheet filter.

export interface FuzzyResult {
  matched: boolean;
  /** Higher is better; 0 means no match. */
  score: number;
  /** Indices in the input string that matched (for highlighting). */
  indices: number[];
}

/**
 * Returns whether `query` fuzzy-matches `text` (subsequence, case-insensitive)
 * along with a quality score. Consecutive matches and word-boundary matches
 * score higher.
 */
export function fuzzyMatch(query: string, text: string): FuzzyResult {
  if (!query) return { matched: true, score: 0, indices: [] };
  const q = query.toLowerCase();
  const t = text.toLowerCase();

  let qi = 0;
  let score = 0;
  let prevMatchIdx = -2;
  const indices: number[] = [];

  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      indices.push(ti);
      let charScore = 1;
      if (ti === prevMatchIdx + 1) charScore += 4; // consecutive run
      const prev = ti === 0 ? " " : t[ti - 1];
      if (prev === " " || prev === "-" || prev === "_" || prev === "/") charScore += 3; // word boundary
      score += charScore;
      prevMatchIdx = ti;
      qi++;
    }
  }

  if (qi < q.length) return { matched: false, score: 0, indices: [] };
  // Slight boost for shorter targets (more precise match).
  score += Math.max(0, 10 - (t.length - q.length) / 5);
  return { matched: true, score, indices };
}
