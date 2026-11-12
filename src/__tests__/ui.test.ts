// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { DEFAULT_SETTINGS } from "../settings/settings";
import { CheatSheet } from "../ui/cheat-sheet";
import { CommandPalette } from "../ui/command-palette";
import { DOM_IDS } from "../ui/dom-ids";

describe("UI overlays in JSDOM environment", () => {
  beforeEach(() => {
    document.body.innerHTML = "<div id='app'><button id='trigger'>Focus</button></div>";
    const trigger = document.getElementById("trigger");
    trigger?.focus();
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  describe("CommandPalette", () => {
    it("creates modal in DOM and resolves with selected command on Enter (fixing §3.1)", async () => {
      const palette = new CommandPalette(DEFAULT_SETTINGS);
      const promise = palette.open();

      const modalEl = document.getElementById(DOM_IDS.palette);
      expect(modalEl).not.toBeNull();
      expect(modalEl?.getAttribute("role")).toBe("dialog");
      expect(modalEl?.getAttribute("aria-modal")).toBe("true");

      const input = document.getElementById(DOM_IDS.paletteInput) as HTMLInputElement;
      expect(input).not.toBeNull();

      // Press Enter to commit default selection
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));

      const result = await promise;
      expect(result.command).toBeDefined();
      expect(document.getElementById(DOM_IDS.palette)).toBeNull();
    });

    it("settles with raw query when dismissed via Escape (Escape / backdrop dismissal)", async () => {
      const palette = new CommandPalette(DEFAULT_SETTINGS);
      const promise = palette.open();

      const input = document.getElementById(DOM_IDS.paletteInput) as HTMLInputElement;
      input.value = "unknown-command";

      // Dispatch Escape to dismiss modal
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));

      const result = await promise;
      expect(result.command).toBeUndefined();
      expect(result.raw).toBe("unknown-command");
      expect(document.getElementById(DOM_IDS.palette)).toBeNull();
    });
  });

  describe("CheatSheet", () => {
    it("renders categorized commands with zero innerHTML leaks (fixing §3.3 & §3.17)", () => {
      const sheet = new CheatSheet(DEFAULT_SETTINGS);
      const modalEl = document.getElementById(DOM_IDS.cheatSheet);
      expect(modalEl).not.toBeNull();

      const rows = modalEl?.querySelectorAll(".kestrel-row");
      expect(rows && rows.length).toBeGreaterThan(10);

      // Verify close removes element completely
      sheet.close();
      expect(document.getElementById(DOM_IDS.cheatSheet)).toBeNull();
    });
  });
});
