import { setDebugEnabled } from "../core/logger";
import { narrowMessage, notifyBackground } from "../core/messages";
import { inspector } from "../debug/inspector";
import { FindController } from "../find/find-controller";
import { HintsController, type HintAction } from "../hints/hints-controller";
import { KeymapResolver, tokenFromEvent } from "../keymap/keymap";
import { OmnibarController, applyOmnibarResult } from "../omnibar/omnibar-controller";
import { TutorialController } from "../onboarding/tutorial";
import { DEFAULT_SETTINGS } from "../settings/settings";
import { resolveSitePolicy } from "../settings/site-policy";
import { settingsStore } from "../storage/storage";
import type { CommandName, ExtensionSettings, SitePolicy } from "../types";
import { CheatSheet } from "../ui/cheat-sheet";
import { CommandPalette } from "../ui/command-palette";
import { anyModalOpen } from "../ui/dom-ids";
import { showToast } from "../ui/toast";
import { VisualController } from "../visual/visual-controller";

import { dispatchCommand, type CommandEffects, type ScrollFractions } from "./dispatch";
import { focusInput } from "./focus";
import { detectInsertMode } from "./insert-mode";
import { MarksStore, jumpToMark } from "./marks";
import { ModeMachine } from "./mode-machine";
import { ScrollEngine } from "./scroll-engine";

// The content controller wires the modules together and owns nothing else: it
// routes keys (ModeMachine), resolves commands (KeymapResolver), decides policy
// (resolveSitePolicy) and delegates every effect to dispatch.ts (§3.21).

let tutorialShownThisSession = false;

/** Memoised insert-mode result, keyed by the element that received the event. */
interface InsertMemo {
  target: EventTarget | null;
  result: ReturnType<typeof detectInsertMode>;
  profiles: SitePolicy["profiles"];
}

class ContentController implements CommandEffects {
  private settings: ExtensionSettings | null = null;
  private policy: SitePolicy | null = null;
  private resolver: KeymapResolver | null = null;
  private readonly modes = new ModeMachine();
  private readonly scrollEngine = new ScrollEngine();
  private readonly hints = new HintsController();
  private readonly visual = new VisualController();
  private readonly marks = new MarksStore();

  private palette: CommandPalette | null = null;
  private cheat: CheatSheet | null = null;
  private find: FindController | null = null;
  private omnibar: OmnibarController | null = null;
  private tutorial: TutorialController | null = null;
  private lastFindQuery = "";

  private buffer: string[] = [];
  private charWait: CommandName | null = null;
  /** D14: last insert-mode decision, reused for repeated keys on one element. */
  private insertMemo: InsertMemo | null = null;

  init(): void {
    // 1. Immediately apply default settings synchronously for 0ms input latency
    this.applySettings(DEFAULT_SETTINGS);
    this.modes.setSettings(DEFAULT_SETTINGS);

    // 2. Attach keydown listener immediately so shortcuts work without waiting for storage IPC
    document.addEventListener("keydown", this.onKeyDown, true);

    // 3. Register extension messaging listeners
    try {
      chrome.runtime?.onMessage?.addListener((raw: unknown) => {
        const msg = narrowMessage(raw);
        if (!msg) return;
        switch (msg.type) {
          case "settings:changed":
            this.applySettings(msg.settings);
            return;
          case "overlay:open":
            this.openOverlay(msg.overlay);
            return;
          case "extension:toggle":
            this.toggleExtension();
            return;
          default:
            return;
        }
      });
    } catch {
      /* no extension context */
    }

    settingsStore.onChange((s) => this.applySettings(s));

    // 4. Concurrently load persisted settings & marks in the background
    void Promise.allSettled([
      settingsStore.init().then((s) => {
        this.applySettings(s);
        if (window.top === window.self && !s.onboarding.completedTutorial) {
          this.maybeShowTutorial();
        }
      }),
      this.marks.init(),
    ]);
  }

  private applySettings(settings: ExtensionSettings): void {
    this.settings = settings;
    setDebugEnabled(settings.debug.enabled);
    this.policy = resolveSitePolicy(settings, { url: location.href });
    this.resolver = new KeymapResolver(this.policy.keymap);
    this.modes.setSettings(settings);
    this.insertMemo = null;
    if (settings.debug.enabled) {
      inspector.update({ profiles: this.policy.profiles.map((p) => p.name) });
    }
  }

  /** The user's configured page fractions for `d`/`u` and `Ctrl+d`/`Ctrl+u`. */
  private fractions(): ScrollFractions {
    const scroll = this.settings?.scroll;
    return {
      half: scroll?.halfPageFraction ?? 0.5,
      full: scroll?.fullPageFraction ?? 1,
    };
  }

  // ---- key routing -------------------------------------------------------

  private onKeyDown = (e: KeyboardEvent): void => {
    const settings = this.settings;
    const policy = this.policy;
    if (!settings || !policy) return;
    if (policy.isDisabled) return;

    // An overlay owns the keyboard while it is open (palette, omnibar, find…).
    if (anyModalOpen()) return;

    if (this.modes.is("hint")) {
      e.preventDefault();
      const stillActive = this.hints.feed(tokenFromEvent(e));
      if (!stillActive) this.modes.reset();
      return;
    }
    if (this.modes.is("visual")) {
      e.preventDefault();
      const stillActive = this.visual.feed(tokenFromEvent(e));
      if (!stillActive) this.modes.reset();
      return;
    }

    if (this.modes.is("insert")) {
      if (e.key === "Escape" || (e.ctrlKey && e.key === "[")) {
        e.preventDefault();
        (document.activeElement as HTMLElement | null)?.blur?.();
        this.modes.reset();
        showToast("Normal mode");
      }
      return;
    }

    const insert = this.insertCheck(e.target, policy);
    if (insert.isEditable) {
      if (e.key === "Escape" || (e.ctrlKey && e.key === "[")) {
        e.preventDefault();
        (e.target as HTMLElement | null)?.blur?.();
        this.modes.reset();
        showToast("Normal mode");
        return;
      }
      this.modes.enter("insert");
      if (settings.debug.enabled) {
        inspector.update({
          insertConfidence: insert.confidence,
          insertProfile: insert.matchedProfile ?? "",
          lastKey: e.key,
        });
      }
      return;
    }

    // Char-waiting commands (setMark / jumpToMark).
    if (this.charWait) {
      e.preventDefault();
      const command = this.charWait;
      this.charWait = null;
      const letter = e.key.toLowerCase();
      if (/^[a-z]$/.test(letter)) this.handleCharCommand(command, letter);
      return;
    }

    const token = tokenFromEvent(e);
    const result = this.resolver!.feed(token, this.buffer);
    if (result.type === "command") {
      e.preventDefault();
      if (settings.debug.enabled) {
        inspector.update({ lastKey: token, resolved: result.command });
      }
      if (result.needsArgument) {
        this.charWait = result.command;
        return;
      }
      this.run(result.command);
    } else if (result.type === "pending") {
      e.preventDefault();
    }
  };

  /**
   * D14: insert-mode detection walks the ancestor chain testing every profile
   * selector — far too much work to repeat on every keystroke of a typing
   * burst. The answer can only change when the focused element or the active
   * profile set changes, so memoise the last one.
   */
  private insertCheck(
    target: EventTarget | null,
    policy: SitePolicy,
  ): ReturnType<typeof detectInsertMode> {
    const memo = this.insertMemo;
    if (memo && memo.target === target && memo.profiles === policy.profiles) {
      return memo.result;
    }
    const result = detectInsertMode(target, policy.profiles);
    this.insertMemo = { target, result, profiles: policy.profiles };
    return result;
  }

  private handleCharCommand(command: CommandName, letter: string): void {
    if (!this.settings) return;
    if (command === "setMark") {
      this.marks.set(letter, window.scrollX, window.scrollY, location.href);
      showToast(`Mark '${letter}' set`);
    } else if (command === "jumpToMark") {
      const mark = this.marks.get(letter);
      if (mark) {
        jumpToMark(mark, this.settings);
        showToast(`Jumped to '${letter}'`);
      } else {
        showToast(`No mark '${letter}'`);
      }
    }
  }

  private run(command: CommandName, args?: string): void {
    if (this.policy?.isCommandDisabled(command)) {
      showToast(`'${command}' is disabled on this site`);
      return;
    }
    // D4: the palette's argument reaches the effect; D7: the user's page
    // fractions reach the scroll commands.
    dispatchCommand(command, this, args, this.fractions());
  }

  // ---- CommandEffects ----------------------------------------------------

  scroll(direction: "down" | "up" | "left" | "right"): void {
    if (this.settings) this.scrollEngine.scrollStep(direction, this.settings);
  }

  scrollPage(fraction: number): void {
    if (this.settings) this.scrollEngine.scrollPage(fraction, this.settings);
  }

  scrollToEdge(edge: "top" | "bottom" | "left" | "right"): void {
    if (this.settings) this.scrollEngine.scrollToEdge(edge, this.settings);
  }

  startHints(action: HintAction): void {
    if (!this.settings) return;
    this.modes.enter("hint");
    void this.hints.show(action, this.settings).then((target) => {
      this.modes.reset();
      if (!target) showToast("No hints available");
    });
  }

  enterVisual(): void {
    if (!this.settings || this.visual.isActive) return;
    const started = this.visual.enter(this.settings, () => this.modes.reset());
    if (!started) {
      showToast("Nothing to select");
      return;
    }
    this.modes.enter("visual");
  }

  /**
   * Open the find bar, optionally pre-filled. The controller is disposed from
   * its own dismiss callback so a closed session stops painting and releases
   * its listeners (D2).
   */
  enterFind(prefill?: string): FindController | null {
    const settings = this.settings;
    if (!settings || this.find) return this.find;

    let controller: FindController | null = null;
    controller = new FindController(settings, () => {
      const finished = controller;
      if (!finished) return;
      this.lastFindQuery = finished.query || this.lastFindQuery;
      finished.dispose();
      if (this.find === finished) this.find = null;
      this.modes.reset();
    });
    this.find = controller;

    const seed = prefill ?? window.getSelection()?.toString().trim() ?? "";
    if (seed) controller.prefill(seed);
    this.modes.enter("find");
    return controller;
  }

  /**
   * `n` / `N`. Reopens the bar pre-filled without re-selecting match 0, then
   * steps once from the remembered index (D3).
   */
  findStep(delta: 1 | -1): void {
    if (this.find) {
      this.find.step(delta);
      return;
    }
    if (!this.lastFindQuery) {
      showToast("No previous search");
      return;
    }
    this.enterFind(this.lastFindQuery)?.step(delta);
  }

  enterInsert(): void {
    this.modes.enter("insert");
    showToast("-- INSERT --");
  }

  enterCommand(): void {
    if (!this.settings || this.palette) return;
    this.modes.enter("command");
    const palette = new CommandPalette(this.settings);
    this.palette = palette;
    void palette.open().then((result) => {
      this.palette = null;
      this.modes.reset();
      // D4: the argument half of the command line reaches the effect.
      if (result.command) this.run(result.command, result.args);
    });
  }

  showHelp(): void {
    if (!this.settings) return;
    if (this.cheat) {
      this.cheat.close();
      this.cheat = null;
      return;
    }
    this.cheat = new CheatSheet(this.settings, () => {
      this.cheat = null;
    });
  }

  backgroundCommand(command: CommandName): void {
    notifyBackground({ type: "command", command });
  }

  openOmnibar(newTab: boolean, prefill?: string): void {
    if (!this.settings || this.omnibar) return;
    const controller = new OmnibarController(this.settings, "all", newTab, prefill);
    this.omnibar = controller;
    void controller.open().then((result) => {
      this.omnibar = null;
      applyOmnibarResult(result);
    });
  }

  openBookmarks(newTab: boolean, prefill?: string): void {
    if (!this.settings || this.omnibar) return;
    const controller = new OmnibarController(this.settings, "bookmarks", newTab, prefill);
    this.omnibar = controller;
    void controller.open().then((result) => {
      this.omnibar = null;
      applyOmnibarResult(result);
    });
  }

  tabSearch(prefill?: string): void {
    if (!this.settings || this.omnibar) return;
    const controller = new OmnibarController(this.settings, "tabs", false, prefill);
    this.omnibar = controller;
    void controller.open().then((result) => {
      this.omnibar = null;
      applyOmnibarResult(result);
    });
  }

  copyUrl(): void {
    void navigator.clipboard
      .writeText(location.href)
      .then(() => showToast("URL copied"))
      .catch(() => showToast("Copy failed"));
  }

  urlGoUp(): void {
    try {
      const url = new URL(location.href);
      let pathname = url.pathname;
      if (pathname.endsWith("/")) {
        pathname = pathname.slice(0, -1);
      }
      const lastSlash = pathname.lastIndexOf("/");
      if (lastSlash >= 0) {
        url.pathname = pathname.slice(0, lastSlash + 1);
        url.search = "";
        url.hash = "";
        location.href = url.href;
      }
    } catch {
      /* ignore */
    }
  }

  urlGoRoot(): void {
    try {
      location.href = location.origin + "/";
    } catch {
      /* ignore */
    }
  }

  openClipboard(newTab: boolean): void {
    void navigator.clipboard
      .readText()
      .then((text) => {
        const t = text.trim();
        if (!t) {
          showToast("Clipboard is empty");
          return;
        }
        const url = /^[a-z][a-z0-9+.-]*:\/\//i.test(t) ? t : "https://" + t;
        if (newTab) window.open(url, "_blank", "noopener");
        else location.href = url;
      })
      .catch(() => showToast("Clipboard is not available"));
  }

  reload(hard: boolean): void {
    this.backgroundCommand(hard ? "hardReload" : "reload");
  }

  focusInput(which: "first" | "last"): void {
    focusInput(which);
  }

  openOptions(): void {
    this.backgroundCommand("openOptions");
  }

  toggleInspector(): void {
    if (this.settings) inspector.toggle(this.settings);
  }

  toggleExtension(): void {
    if (!this.settings) return;
    const host = location.host;
    const isDisabled = this.policy?.isDisabled ?? false;
    void settingsStore.update((s) => {
      if (isDisabled) {
        s.disabledSites = s.disabledSites.filter((d) => d !== host);
      } else if (!s.disabledSites.includes(host)) {
        s.disabledSites.push(host);
      }
    });
    showToast(isDisabled ? "Kestrel enabled on this site" : "Kestrel disabled on this site");
  }

  // ---- onboarding --------------------------------------------------------

  /**
   * Show the first-run tour once per session. `completedTutorial` is set when
   * the tour *finishes* (D13) — marking it complete at construction meant
   * closing the tab on step 1 made the tour disappear forever.
   */
  private maybeShowTutorial(): void {
    if (tutorialShownThisSession || !this.settings || this.tutorial) return;
    tutorialShownThisSession = true;
    window.setTimeout(() => {
      const current = this.settings;
      if (!current || this.tutorial) return;
      this.tutorial = new TutorialController(current, () => {
        this.tutorial = null;
        void settingsStore.update((s) => {
          s.onboarding.completedTutorial = true;
        });
      });
    }, 800);
  }

  /** Open an overlay requested by a browser command / toolbar click. */
  private openOverlay(overlay: "palette" | "omnibar" | "omnibarNewTab" | "tabSearch"): void {
    switch (overlay) {
      case "palette":
        this.enterCommand();
        return;
      case "omnibar":
        this.openOmnibar(false);
        return;
      case "omnibarNewTab":
        this.openOmnibar(true);
        return;
      case "tabSearch":
        this.tabSearch();
        return;
    }
  }
}

// Boot only in a real extension content-script context.
const GLOBAL_INSTALL_KEY = "__kestrel_installed__";
if (
  typeof window !== "undefined" &&
  typeof chrome !== "undefined" &&
  (chrome.runtime?.id || chrome.runtime?.onMessage)
) {
  const win = window as unknown as Record<string, boolean>;
  if (!win[GLOBAL_INSTALL_KEY]) {
    win[GLOBAL_INSTALL_KEY] = true;
    const controller = new ContentController();
    controller.init();
  }
}

export { ContentController };
