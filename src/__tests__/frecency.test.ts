import { describe, it, expect } from "vitest";

import { frecencyScore, blendedRank } from "../omnibar/frecency";
import { fuzzyMatch } from "../omnibar/fuzzy";

const HOUR = 3600_000;
const now = 1_000_000_000_000;

describe("frecencyScore", () => {
  it("scores recent, frequently-visited items higher", () => {
    const recent = { lastVisited: now - HOUR, visitCount: 10 };
    const old = { lastVisited: now - 40 * 24 * HOUR, visitCount: 10 };
    expect(frecencyScore(recent, now)).toBeGreaterThan(frecencyScore(old, now));
  });

  it("rewards typed entries", () => {
    const base = { lastVisited: now - HOUR, visitCount: 5 };
    const typed = { lastVisited: now - HOUR, visitCount: 5, typed: 3 };
    expect(frecencyScore(typed, now)).toBeGreaterThan(frecencyScore(base, now));
  });
});

describe("blendedRank", () => {
  it("combines frecency with fuzzy match ratio", () => {
    const item = { lastVisited: now - HOUR, visitCount: 8 };
    const rank = blendedRank(item, 0.9, { now });
    expect(rank).toBeGreaterThan(0);
  });
});

describe("fuzzyMatch", () => {
  it("matches a subsequence case-insensitively", () => {
    expect(fuzzyMatch("gmail", "GMail").matched).toBe(true);
  });
  it("rejects non-subsequence", () => {
    expect(fuzzyMatch("xyz", "gmail").matched).toBe(false);
  });
  it("matches everything for an empty query", () => {
    expect(fuzzyMatch("", "anything").matched).toBe(true);
  });
  it("scores word-boundary matches higher", () => {
    const boundary = fuzzyMatch("tab", "Tab Search");
    const mid = fuzzyMatch("tab", "stability");
    expect(boundary.score).toBeGreaterThan(mid.score);
  });
});
