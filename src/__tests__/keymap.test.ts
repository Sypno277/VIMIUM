import { describe, it, expect } from "vitest";

import { DEFAULT_KEYMAP } from "../commands/commands";
import { KeymapResolver, tokenFromEvent, findConflicts, chordToTokens } from "../keymap/keymap";

type Buf = string[];

describe("tokenFromEvent", () => {
  it("normalizes a single letter", () => {
    expect(tokenFromEvent({ key: "g", shiftKey: false, ctrlKey: false, altKey: false, metaKey: false })).toBe("g");
  });
  it("normalizes shifted letters with Shift+", () => {
    expect(tokenFromEvent({ key: "G", shiftKey: true, ctrlKey: false, altKey: false, metaKey: false })).toBe("Shift+G");
  });
  it("keeps symbol chars like ? and ; unchanged", () => {
    expect(tokenFromEvent({ key: "?", shiftKey: true, ctrlKey: false, altKey: false, metaKey: false })).toBe("?");
    expect(tokenFromEvent({ key: ";", shiftKey: false, ctrlKey: false, altKey: false, metaKey: false })).toBe(";");
  });
  it("normalizes ctrl chords", () => {
    expect(tokenFromEvent({ key: "d", shiftKey: false, ctrlKey: true, altKey: false, metaKey: false })).toBe("Ctrl+d");
  });
});

describe("KeymapResolver", () => {
  it("resolves a single-key command", () => {
    const r = new KeymapResolver({ scrollDown: ["j"] });
    const buf: Buf = [];
    expect(r.feed("j", buf)).toEqual({ type: "command", command: "scrollDown" });
  });

  it("resolves a two-key chord (gg)", () => {
    const r = new KeymapResolver({ scrollToTop: ["g g"] });
    const buf: Buf = [];
    expect(r.feed("g", buf)).toEqual({ type: "pending" });
    expect(r.feed("g", buf)).toEqual({ type: "command", command: "scrollToTop" });
  });

  it("waits when prefix of multiple bindings", () => {
    const r = new KeymapResolver({ scrollToTop: ["g g"], tabNext: ["g t"] });
    const buf: Buf = [];
    expect(r.feed("g", buf)).toEqual({ type: "pending" });
    expect(r.feed("t", buf)).toEqual({ type: "command", command: "tabNext" });
  });

  it("returns none and resets on dead key", () => {
    const r = new KeymapResolver({ scrollDown: ["j"] });
    const buf: Buf = [];
    expect(r.feed("z", buf)).toEqual({ type: "none" });
    expect(buf.length).toBe(0);
  });

  it("resolves a command needing an argument", () => {
    const r = new KeymapResolver({ setMark: ["m"] });
    const buf: Buf = [];
    const res = r.feed("m", buf);
    expect(res).toEqual({ type: "command", command: "setMark", needsArgument: true });
  });
});

describe("findConflicts", () => {
  it("finds no conflicts in the default keymap", () => {
    expect(findConflicts(DEFAULT_KEYMAP)).toHaveLength(0);
  });
  it("detects a duplicated chord", () => {
    const conflicts = findConflicts({ scrollDown: ["j"], scrollUp: ["j"] });
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].commands).toContain("scrollDown");
    expect(conflicts[0].commands).toContain("scrollUp");
  });
});

describe("chordToTokens", () => {
  it("splits multi-key chords", () => {
    expect(chordToTokens("g g")).toEqual(["g", "g"]);
    expect(chordToTokens("Shift+F")).toEqual(["Shift+F"]);
  });
});
