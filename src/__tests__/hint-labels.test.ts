import { describe, it, expect } from "vitest";

import { assignHintLabels } from "../hints/hint-labels";

const letters = { chars: "asdfghjkl", style: "letters" as const, homeRowPriority: false };

describe("assignHintLabels", () => {
  it("returns no labels for no targets", () => {
    expect(assignHintLabels([], { ...letters, chars: "asdf" })).toEqual([]);
  });

  it("assigns unique labels to each target", () => {
    const targets = [{ isPrimary: false }, { isPrimary: false }, { isPrimary: false }];
    const labels = assignHintLabels(targets, letters);
    expect(labels).toHaveLength(3);
    expect(new Set(labels).size).toBe(3);
  });

  it("prefers shorter labels first without home-row priority", () => {
    const targets = Array.from({ length: 10 }, () => ({ isPrimary: false }));
    const labels = assignHintLabels(targets, letters);
    // Single chars should be the first batch.
    expect(labels.filter((l) => l.length === 1).length).toBeGreaterThanOrEqual(8);
  });

  it("gives primary targets the easiest labels when home-row priority is on", () => {
    const targets = [
      { isPrimary: true },
      { isPrimary: false },
      { isPrimary: false },
      { isPrimary: false },
    ];
    const labels = assignHintLabels(targets, { ...letters, homeRowPriority: true });
    expect(labels[0].length).toBe(1);
    expect(["a"]).toContain(labels[0]);
  });

  it("falls back to a sane charset when chars too short", () => {
    const labels = assignHintLabels(
      [{ isPrimary: false }, { isPrimary: false }],
      { chars: "a", style: "letters", homeRowPriority: true },
    );
    expect(labels).toHaveLength(2);
    expect(new Set(labels).size).toBe(2);
  });

  it("numbers style yields decimal labels", () => {
    const labels = assignHintLabels(
      Array.from({ length: 12 }, () => ({ isPrimary: false })),
      { chars: "asdf", style: "numbers", homeRowPriority: false },
    );
    expect(labels[0]).toBe("1");
    expect(labels[11]).toBe("12");
    expect(new Set(labels).size).toBe(12);
  });
});
