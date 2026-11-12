import { describe, expect, it } from "vitest";

import { parseVimiumConfig, parseVimiumKeys } from "../migration/vimium";

describe("vimium migration parser", () => {
  describe("parseVimiumKeys", () => {
    it("parses single characters", () => {
      expect(parseVimiumKeys("j")).toEqual(["j"]);
      expect(parseVimiumKeys("gg")).toEqual(["g", "g"]);
    });

    it("parses control and shift modifiers", () => {
      expect(parseVimiumKeys("<c-d>")).toEqual(["Ctrl+d"]);
      expect(parseVimiumKeys("<c-u>")).toEqual(["Ctrl+u"]);
      expect(parseVimiumKeys("<s-f>")).toEqual(["Shift+F"]);
    });

    it("returns null for invalid angle bracket specs", () => {
      expect(parseVimiumKeys("<unclosed")).toBeNull();
      expect(parseVimiumKeys("<x-y>")).toBeNull();
    });
  });

  describe("parseVimiumConfig", () => {
    it("parses standard map commands and maps to Kestrel command names", () => {
      const config = `
        # Comment line
        " Another comment style
        map j scrollDown
        map k scrollUp
        map <c-d> scrollPageDown
        map F LinkHints.activateModeToOpenInNewTab
      `;

      const result = parseVimiumConfig(config);
      expect(result.imported).toBe(4);
      expect(result.keymap.scrollDown).toEqual(["j"]);
      expect(result.keymap.scrollUp).toEqual(["k"]);
      expect(result.keymap.scrollPageDown).toEqual(["Ctrl+d"]);
      expect(result.keymap.hintOpenNewTab).toEqual(["F"]);
    });

    it("handles unmap and unmapAll directives", () => {
      const config = `
        unmap j
        map j scrollUp
      `;

      const initialKeymap = { scrollDown: ["j"], scrollUp: ["k"] };
      const result = parseVimiumConfig(config, initialKeymap);
      expect(result.keymap.scrollDown).toEqual([]);
      expect(result.keymap.scrollUp).toEqual(["k", "j"]);
    });

    it("reports unsupported commands and unparseable lines", () => {
      const config = `
        map z imaginaryVimiumCommand
        mapKey a b
        randomgarbage
      `;

      const result = parseVimiumConfig(config);
      expect(result.unsupportedCommands).toContain("imaginaryVimiumCommand");
      expect(result.skipped.length).toBe(3);
    });
  });
});
