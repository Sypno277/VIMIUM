import type { HintAction } from "../hints/hints-controller";
import type { CommandName } from "../types";

// Pure mapping from a resolved command to an effect call. This file holds no
// policy (no site checks, no insert-mode logic) — the controller decides
// whether a command is allowed, and this table decides what it does (§3.21).
// The exhaustive switch means a new CommandName without an effect is a compile
// error rather than a silently dead key.
//
// D4: `args` (from the palette's command line, e.g. `:tabopen <url>`) is
//     threaded through to the effects that can use it, so the argument grammar
//     in `commands/arguments.ts` actually reaches the overlay it was typed for.

export interface CommandEffects {
  scroll(direction: "down" | "up" | "left" | "right"): void;
  /** Scroll by a fraction of the viewport: positive down, negative up. */
  scrollPage(fraction: number): void;
  scrollToEdge(edge: "top" | "bottom" | "left" | "right"): void;

  startHints(action: HintAction): void;
  enterVisual(): void;
  /** Open the find bar, optionally pre-filled with `prefill`. */
  enterFind(prefill?: string): void;
  enterCommand(): void;
  enterInsert(): void;
  showHelp(): void;

  /** Run a command that must be handled by the background (tabs, history). */
  backgroundCommand(command: CommandName): void;

  /** Open the omnibar, optionally pre-filled with `prefill`. */
  openOmnibar(newTab: boolean, prefill?: string): void;
  openBookmarks(newTab: boolean, prefill?: string): void;
  tabSearch(prefill?: string): void;

  copyUrl(): void;
  urlGoUp(): void;
  urlGoRoot(): void;
  openClipboard(newTab: boolean): void;
  reload(hard: boolean): void;
  focusInput(which: "first" | "last"): void;

  findStep(delta: 1 | -1): void;

  openOptions(): void;
  toggleInspector(): void;
  toggleExtension(): void;
}

/** The page fractions `scrollHalf*` / `scrollPage*` should use (D7). */
export interface ScrollFractions {
  half: number;
  full: number;
}

export const DEFAULT_SCROLL_FRACTIONS: ScrollFractions = { half: 0.5, full: 1 };

/**
 * Run the effect for `command`. Returns false for commands with no effect.
 *
 * `args` is the argument half of a palette command line; `fractions` carries
 * the user's configured page heights (`scroll.halfPageFraction`, etc.).
 */
export function dispatchCommand(
  command: CommandName,
  fx: CommandEffects,
  args?: string,
  fractions: ScrollFractions = DEFAULT_SCROLL_FRACTIONS,
): boolean {
  switch (command) {
    case "scrollDown":
      fx.scroll("down");
      return true;
    case "scrollUp":
      fx.scroll("up");
      return true;
    case "scrollLeft":
      fx.scroll("left");
      return true;
    case "scrollRight":
      fx.scroll("right");
      return true;
    case "scrollToTop":
      fx.scrollToEdge("top");
      return true;
    case "scrollToBottom":
      fx.scrollToEdge("bottom");
      return true;
    case "scrollHalfDown":
      fx.scrollPage(fractions.half);
      return true;
    case "scrollHalfUp":
      fx.scrollPage(-fractions.half);
      return true;
    case "scrollPageDown":
      fx.scrollPage(fractions.full);
      return true;
    case "scrollPageUp":
      fx.scrollPage(-fractions.full);
      return true;
    case "scrollFullLeft":
      fx.scrollToEdge("left");
      return true;
    case "scrollFullRight":
      fx.scrollToEdge("right");
      return true;
    case "urlGoUp":
      fx.urlGoUp();
      return true;
    case "urlGoRoot":
      fx.urlGoRoot();
      return true;

    case "hintOpen":
      fx.startHints("open");
      return true;
    case "hintOpenNewTab":
      fx.startHints("openNewTab");
      return true;
    case "hintHover":
      fx.startHints("hover");
      return true;
    case "hintCopy":
      fx.startHints("copyUrl");
      return true;

    case "enterVisualMode":
      fx.enterVisual();
      return true;
    case "enterFindMode":
      fx.enterFind(args);
      return true;
    case "enterCommandMode":
      fx.enterCommand();
      return true;
    case "enterInsertMode":
      fx.enterInsert();
      return true;
    case "showHelp":
      fx.showHelp();
      return true;

    case "findNext":
      fx.findStep(1);
      return true;
    case "findPrev":
      fx.findStep(-1);
      return true;

    case "openOmnibar":
      fx.openOmnibar(false, args);
      return true;
    case "openOmnibarNewTab":
      fx.openOmnibar(true, args);
      return true;
    case "openBookmarks":
      fx.openBookmarks(false, args);
      return true;
    case "openBookmarksNewTab":
      fx.openBookmarks(true, args);
      return true;
    case "tabSearch":
      fx.tabSearch(args);
      return true;

    case "copyUrl":
      fx.copyUrl();
      return true;
    case "openClipboard":
      fx.openClipboard(false);
      return true;
    case "openClipboardNewTab":
      fx.openClipboard(true);
      return true;
    case "focusFirstInput":
      fx.focusInput("first");
      return true;
    case "focusLastInput":
      fx.focusInput("last");
      return true;

    case "openOptions":
      fx.openOptions();
      return true;
    case "openInspector":
      fx.toggleInspector();
      return true;
    case "toggleExtension":
      fx.toggleExtension();
      return true;

    case "setMark":
    case "jumpToMark":
      // Handled by the controller's char-wait state machine before dispatch.
      return false;

    // Commands owned by the background.
    case "tabNext":
    case "tabPrev":
    case "tabClose":
    case "tabRestore":
    case "tabNew":
    case "moveTabLeft":
    case "moveTabRight":
    case "moveTabToNewWindow":
    case "duplicateTab":
    case "togglePinTab":
    case "historyBack":
    case "historyForward":
    case "reload":
      if (command === "reload") {
        fx.reload(false);
        return true;
      }
      fx.backgroundCommand(command);
      return true;
    case "hardReload":
      fx.reload(true);
      return true;
  }
}
