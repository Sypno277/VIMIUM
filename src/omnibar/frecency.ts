// Frecency scoring (frequency + recency) used to rank omnibar and tab-search
// results. Tunable weights keep the algorithm easy to adjust from settings.

export interface FrecencyItem {
  /** Epoch ms of last visit. */
  lastVisited: number;
  /** Total visit count. */
  visitCount: number;
  /** How many times the user typed/pasted the exact URL (strong signal). */
  typed?: number;
}

/** Recency buckets (Firefox-style), returns a 0-100 weight. */
function recencyWeight(ageMs: number): number {
  const hour = 3600_000;
  const day = 24 * hour;
  if (ageMs < 4 * hour) return 100;
  if (ageMs < 1 * day) return 70;
  if (ageMs < 7 * day) return 50;
  if (ageMs < 30 * day) return 30;
  return 10;
}

/**
 * Compute a blended frecency score. Higher is better.
 * score = recencyWeight * (1 + 0.1 * min(visitCount, 20)) + typedBonus
 */
export function frecencyScore(item: FrecencyItem, now: number = Date.now()): number {
  const ageMs = Math.max(0, now - item.lastVisited);
  const recency = recencyWeight(ageMs);
  const visitBoost = 1 + 0.1 * Math.min(item.visitCount, 20);
  const typedBonus = (item.typed ?? 0) * 50;
  return recency * visitBoost + typedBonus;
}

/**
 * Combine a frecency score with a fuzzy-match ratio (0-1) into a single
 * ranking number. Tunable via `fuzzyWeight`.
 */
export function blendedRank(
  item: FrecencyItem,
  fuzzyRatio: number,
  opts: { fuzzyWeight?: number; now?: number } = {},
): number {
  const fuzzyWeight = opts.fuzzyWeight ?? 0.4;
  const base = frecencyScore(item, opts.now);
  // Normalize frecency roughly into 0-1 so the two terms are comparable.
  const normalized = base / 300;
  return normalized * (1 - fuzzyWeight) + fuzzyRatio * fuzzyWeight;
}
