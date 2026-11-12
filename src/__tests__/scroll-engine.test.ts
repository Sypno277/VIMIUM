// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { dispatchCommand, type CommandEffects } from "../content/dispatch";
import { ScrollEngine } from "../content/scroll-engine";
import { DEFAULT_SETTINGS } from "../settings/settings";
import type { ExtensionSettings } from "../types";

// D7 regression pin: `d`/`u` ignored `halfPageFraction` and multiplied the page
// height by `scroll.acceleration`, so one `d` could scroll two half-pages.
// D4 regression pin: the palette's argument was parsed and then discarded.

function settingsWith(overrides: Partial<ExtensionSettings["scroll"]>): ExtensionSettings {
  return { ...DEFAULT_SETTINGS, scroll: { ...DEFAULT_SETTINGS.scroll, ...overrides } };
}

function stubLayout(documentHeight: number, viewport: number): void {
  Object.defineProperty(document.documentElement, "scrollHeight", {
    configurable: true,
    value: documentHeight,
  });
  Object.defineProperty(window, "innerHeight", { configurable: true, value: viewport });
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 1024 });
  Object.defineProperty(window, "scrollY", { configurable: true, writable: true, value: 0 });
  Object.defineProperty(window, "scrollX", { configurable: true, writable: true, value: 0 });
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: () => ({ matches: true, addEventListener: () => undefined }),
  });
}

describe("ScrollEngine page fractions (D7)", () => {
  let scrollTo: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    document.body.innerHTML = "";
    stubLayout(5000, 1000);
    scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("honours the configured half-page fraction", () => {
    const engine = new ScrollEngine();
    const settings = settingsWith({ halfPageFraction: 0.25, respectReducedMotion: true });

    engine.scrollPage(settings.scroll.halfPageFraction, settings);

    const [, y] = scrollTo.mock.calls[scrollTo.mock.calls.length - 1] as [number, number];
    expect(y).toBe(250); // 0.25 x 1000px viewport
  });

  it("does not multiply a page scroll by the acceleration setting", () => {
    const engine = new ScrollEngine();
    const settings = settingsWith({
      fullPageFraction: 1,
      acceleration: 3,
      respectReducedMotion: true,
    });

    engine.scrollPage(settings.scroll.fullPageFraction, settings);

    const [, y] = scrollTo.mock.calls[scrollTo.mock.calls.length - 1] as [number, number];
    expect(y).toBe(1000); // exactly one viewport, not three
  });

  it("refuses to scroll past the document edge", () => {
    const engine = new ScrollEngine();
    stubLayout(500, 1000); // nothing to scroll
    const settings = settingsWith({ respectReducedMotion: true });

    engine.scrollStep("down", settings);

    expect(scrollTo).not.toHaveBeenCalled();
  });
});

describe("dispatchCommand (D4 / D7)", () => {
  function recorder(): CommandEffects & { calls: Record<string, unknown[]> } {
    const calls: Record<string, unknown[]> = {};
    const record =
      (name: string) =>
      (...args: unknown[]): void => {
        calls[name] = args;
      };
    return {
      calls,
      scroll: record("scroll") as CommandEffects["scroll"],
      scrollPage: record("scrollPage") as CommandEffects["scrollPage"],
      scrollToEdge: record("scrollToEdge") as CommandEffects["scrollToEdge"],
      startHints: record("startHints") as CommandEffects["startHints"],
      enterVisual: record("enterVisual") as CommandEffects["enterVisual"],
      enterFind: record("enterFind") as CommandEffects["enterFind"],
      enterCommand: record("enterCommand") as CommandEffects["enterCommand"],
      enterInsert: record("enterInsert") as CommandEffects["enterInsert"],
      showHelp: record("showHelp") as CommandEffects["showHelp"],
      backgroundCommand: record("backgroundCommand") as CommandEffects["backgroundCommand"],
      openOmnibar: record("openOmnibar") as CommandEffects["openOmnibar"],
      openBookmarks: record("openBookmarks") as CommandEffects["openBookmarks"],
      tabSearch: record("tabSearch") as CommandEffects["tabSearch"],
      copyUrl: record("copyUrl") as CommandEffects["copyUrl"],
      urlGoUp: record("urlGoUp") as CommandEffects["urlGoUp"],
      urlGoRoot: record("urlGoRoot") as CommandEffects["urlGoRoot"],
      openClipboard: record("openClipboard") as CommandEffects["openClipboard"],
      reload: record("reload") as CommandEffects["reload"],
      focusInput: record("focusInput") as CommandEffects["focusInput"],
      findStep: record("findStep") as CommandEffects["findStep"],
      openOptions: record("openOptions") as CommandEffects["openOptions"],
      toggleInspector: record("toggleInspector") as CommandEffects["toggleInspector"],
      toggleExtension: record("toggleExtension") as CommandEffects["toggleExtension"],
    };
  }

  it("passes the command-line argument to the omnibar (D4)", () => {
    const fx = recorder();
    dispatchCommand("openOmnibarNewTab", fx, "example.com");
    expect(fx.calls.openOmnibar).toEqual([true, "example.com"]);
  });

  it("passes the command-line argument to find (D4)", () => {
    const fx = recorder();
    dispatchCommand("enterFindMode", fx, "needle");
    expect(fx.calls.enterFind).toEqual(["needle"]);
  });

  it("uses the configured page fractions (D7)", () => {
    const fx = recorder();
    dispatchCommand("scrollHalfDown", fx, undefined, { half: 0.25, full: 0.75 });
    expect(fx.calls.scrollPage).toEqual([0.25]);

    dispatchCommand("scrollPageUp", fx, undefined, { half: 0.25, full: 0.75 });
    expect(fx.calls.scrollPage).toEqual([-0.75]);
  });

  it("reports handled/not-handled consistently", () => {
    const fx = recorder();
    expect(dispatchCommand("showHelp", fx)).toBe(true);
    // The mark commands are handled by the controller's char-wait machine.
    expect(dispatchCommand("setMark", fx)).toBe(false);
    expect(dispatchCommand("jumpToMark", fx)).toBe(false);
  });
});
