import { describe, expect, it } from "vitest";

import { COMMANDS } from "../commands/commands";
import { DEFAULT_KEYMAP, UNBOUND_BY_DESIGN } from "../commands/defaults";
import { findConflicts } from "../keymap/conflicts";
import type { CommandCategory } from "../types";

const VALID_CATEGORIES: Set<CommandCategory> = new Set([
  "navigation",
  "tabs",
  "links",
  "editing",
  "urls",
  "misc",
]);

describe("commands registry integrity", () => {
  it("every declared command has a full CommandDef", () => {
    expect(COMMANDS.length).toBeGreaterThanOrEqual(30);
    for (const cmd of COMMANDS) {
      expect(cmd.name).toBeTruthy();
      expect(cmd.label).toBeTruthy();
      expect(cmd.description).toBeTruthy();
      expect(VALID_CATEGORIES.has(cmd.category)).toBe(true);

      if (cmd.needsArgument) {
        expect(["char", "chord"]).toContain(cmd.argType);
      }
    }
  });

  it("every command name is unique", () => {
    const names = COMMANDS.map((c) => c.name);
    const unique = new Set(names);
    expect(unique.size).toBe(names.length);
  });

  it("every command is either bound in DEFAULT_KEYMAP or explicitly documented in UNBOUND_BY_DESIGN", () => {
    const boundNames = new Set(Object.keys(DEFAULT_KEYMAP));
    const unboundNames = new Set(Object.keys(UNBOUND_BY_DESIGN));

    for (const cmd of COMMANDS) {
      const isBound = boundNames.has(cmd.name);
      const isDocumentedUnbound = unboundNames.has(cmd.name);
      expect(
        isBound || isDocumentedUnbound,
        `Command '${cmd.name}' must either have a default binding or be documented in UNBOUND_BY_DESIGN`,
      ).toBe(true);
    }
  });

  it("DEFAULT_KEYMAP has zero chord conflicts", () => {
    const conflicts = findConflicts(DEFAULT_KEYMAP);
    expect(conflicts).toEqual([]);
  });
});
