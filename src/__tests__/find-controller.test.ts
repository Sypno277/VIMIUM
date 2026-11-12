// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FindController } from "../find/find-controller";
import { DEFAULT_SETTINGS } from "../settings/settings";
import { DOM_IDS } from "../ui/dom-ids";

// D2 regression pin: a closed find session kept its window listeners and
// repainted a detached layer on every later scroll, once per session.
// D3 regression pin: `n` restarted at match 0 instead of resuming.

function pageWith(paragraphs: number, word = "target"): void {
  document.body.innerHTML = Array.from(
    { length: paragraphs },
    (_, i) => `<p>alpha beta ${word} ${i}</p>`,
  ).join("");
}

function fakeRect(): DOMRect {
  return {
    x: 0,
    y: 0,
    width: 40,
    height: 10,
    top: 0,
    left: 0,
    right: 40,
    bottom: 10,
    toJSON: () => ({}),
  } as DOMRect;
}

describe("FindController", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    Element.prototype.scrollIntoView = () => undefined;
    // jsdom implements neither of these; give the controller real geometry.
    Range.prototype.getClientRects = function (): DOMRectList {
      return [fakeRect()] as unknown as DOMRectList;
    };
    Range.prototype.getBoundingClientRect = function (): DOMRect {
      return fakeRect();
    };
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("removes both window listeners on dispose, and dispose is idempotent (D2)", () => {
    const remove = vi.spyOn(window, "removeEventListener");
    const controller = new FindController(DEFAULT_SETTINGS, () => undefined);

    controller.dispose();
    const count = (): number =>
      remove.mock.calls.filter((c) => {
        const name = String(c[0]);
        return name === "scroll" || name === "resize";
      }).length;
    expect(count()).toBe(2);

    controller.dispose();
    // A second dispose must not touch the listeners again.
    expect(count()).toBe(2);
  });

  it("is inert after dispose: the overlay is gone and a scroll is harmless (D2)", () => {
    pageWith(3);
    const controller = new FindController(DEFAULT_SETTINGS, () => undefined);
    controller.prefill("target");
    expect(controller.matchCount).toBe(3);

    controller.dispose();

    expect(() => window.dispatchEvent(new Event("scroll"))).not.toThrow();
    expect(document.getElementById(DOM_IDS.find)).toBeNull();
  });

  it("resumes a query at its remembered match rather than restarting (D3)", () => {
    pageWith(5);
    let closed = false;
    const first = new FindController(DEFAULT_SETTINGS, () => {
      closed = true;
    });
    first.prefill("target");
    expect(first.currentIndex).toBe(0);

    first.step(1);
    first.step(1);
    expect(first.currentIndex).toBe(2);
    first.dispose();
    expect(closed).toBe(true);

    // A fresh session for the same query resumes at 2, so `n` continues.
    const second = new FindController(DEFAULT_SETTINGS, () => undefined);
    second.prefill("target");
    expect(second.currentIndex).toBe(2);

    second.step(1);
    expect(second.currentIndex).toBe(3);
    second.dispose();
  });

  it("counts only the matches for the current query", () => {
    // One occurrence per paragraph: "alpha" appears exactly three times.
    document.body.innerHTML = Array.from(
      { length: 3 },
      (_, i) => `<p>alpha item ${i}</p>`,
    ).join("");
    const controller = new FindController(DEFAULT_SETTINGS, () => undefined);
    controller.prefill("alpha");
    expect(controller.matchCount).toBe(3);
    controller.dispose();
  });
});
