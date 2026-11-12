// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { DEFAULT_SETTINGS } from "../settings/settings";
import { anyModalOpen, DOM_IDS } from "../ui/dom-ids";
import { VisualController } from "../visual/visual-controller";

// D1 regression pin: the visual toolbar used to carry a *modal* id, so
// `anyModalOpen()` returned true for the whole session and the content
// controller swallowed every key — including Escape — locking the user into
// visual mode until they reloaded the page.

function stubGeometry(): void {
  Element.prototype.getBoundingClientRect = function (this: Element): DOMRect {
    return {
      x: 10,
      y: 10,
      width: 120,
      height: 24,
      top: 10,
      left: 10,
      right: 130,
      bottom: 34,
      toJSON: () => ({}),
    } as DOMRect;
  };
}

describe("VisualController", () => {
  beforeEach(() => {
    document.documentElement.innerHTML = "<head></head><body></body>";
    stubGeometry();
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1024 });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 768 });
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("does not claim the keyboard while active (D1)", () => {
    document.body.innerHTML = `
      <a href="https://example.com/one">one</a>
      <a href="https://example.com/two">two</a>
    `;
    const visual = new VisualController();
    expect(visual.enter(DEFAULT_SETTINGS, () => undefined)).toBe(true);

    expect(document.getElementById(DOM_IDS.visualBar)).not.toBeNull();
    expect(anyModalOpen()).toBe(false);
  });

  it("Escape exits visual mode and removes its overlays", () => {
    document.body.innerHTML = `<a href="https://example.com/one">one</a>`;
    const visual = new VisualController();
    let exits = 0;
    visual.enter(DEFAULT_SETTINGS, () => {
      exits += 1;
    });

    expect(visual.feed("Escape")).toBe(false);
    expect(visual.isActive).toBe(false);
    expect(document.getElementById(DOM_IDS.visualBar)).toBeNull();
    expect(document.getElementById(DOM_IDS.hints)).toBeNull();
    expect(exits).toBe(1);
  });

  it("Ctrl+[ also exits, and the callback fires exactly once", () => {
    document.body.innerHTML = `<button>save</button>`;
    const visual = new VisualController();
    let exits = 0;
    visual.enter(DEFAULT_SETTINGS, () => {
      exits += 1;
    });

    expect(visual.feed("Ctrl+[")).toBe(false);
    expect(visual.feed("Escape")).toBe(false);
    expect(exits).toBe(1);
  });

  it("reports when there is nothing to select", () => {
    document.body.innerHTML = "";
    const visual = new VisualController();
    expect(visual.enter(DEFAULT_SETTINGS, () => undefined)).toBe(false);
    expect(visual.isActive).toBe(false);
  });
});
