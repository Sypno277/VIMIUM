import { notifyBackground } from "../core/messages";
import { perfEnd, perfStart } from "../core/perf";
import type { ExtensionSettings } from "../types";
import { DOM_IDS } from "../ui/dom-ids";
import { Modal } from "../ui/modal";

import { engineHint } from "./engines";
import {
  EMPTY_SOURCES,
  loadSources,
  rankItems,
  toNavigableUrl,
  type OmnibarItem,
  type SourceData,
} from "./sources";

// The omnibar overlay: URL entry, frecency-ranked history/bookmarks, open tabs,
// and keyword search engines (`g foo`). Tab search (`T`) is the same class with
// `scope: "tabs"`, so both overlays share one keyboard model.

export type OmnibarScope = "all" | "tabs" | "bookmarks";

export interface OmnibarResult {
  action: "navigate" | "activateTab" | "cancel";
  url?: string;
  tabId?: number;
  openInNewTab: boolean;
}

const MAX_RESULTS = 12;

export class OmnibarController extends Modal {
  private readonly input: HTMLInputElement;
  private readonly listEl: HTMLElement;
  private readonly footer: HTMLElement;
  private readonly settings: ExtensionSettings;
  private readonly scope: OmnibarScope;
  private readonly openInNewTabDefault: boolean;
  /** Seed text for the input (`:tabopen <url>`, `:open foo`). */
  private readonly prefill: string;
  private sources: SourceData = EMPTY_SOURCES;
  private items: OmnibarItem[] = [];
  private active = 0;
  private resolver: ((r: OmnibarResult) => void) | null = null;

  constructor(
    settings: ExtensionSettings,
    scope: OmnibarScope,
    openInNewTab = false,
    prefill = "",
  ) {
    super(
      {
        id: scope === "tabs" ? DOM_IDS.tabSearch : DOM_IDS.omnibar,
        ariaLabel:
          scope === "tabs"
            ? "Search open tabs"
            : scope === "bookmarks"
            ? "Search bookmarks"
            : "Address and search bar",
        onDismiss: () => this.settle({ action: "cancel", openInNewTab: false }),
      },
      settings,
    );
    this.settings = settings;
    this.scope = scope;
    this.openInNewTabDefault = openInNewTab;
    this.prefill = prefill;

    this.panel.style.width = "min(680px, 92vw)";
    this.panel.style.marginTop = "10vh";
    this.panel.style.display = "flex";
    this.panel.style.flexDirection = "column";

    this.input = document.createElement("input");
    this.input.id = scope === "tabs" ? DOM_IDS.tabSearch + "-input" : DOM_IDS.omnibarInput;
    this.input.className = "kestrel-input";
    this.input.type = "text";
    this.input.placeholder =
      scope === "tabs"
        ? "Search open tabs…"
        : scope === "bookmarks"
        ? "Search bookmarks…"
        : "Search history, bookmarks, tabs — or type a URL / 'g query'";
    this.input.setAttribute(
      "aria-label",
      scope === "tabs" ? "Tab search" : scope === "bookmarks" ? "Bookmark search" : "Address and search",
    );
    this.input.setAttribute("role", "combobox");
    this.input.setAttribute("aria-expanded", "true");
    this.input.setAttribute("data-autofocus", "true");
    this.input.addEventListener("input", () => {
      this.active = 0;
      this.render();
    });
    this.input.addEventListener("keydown", (e) => this.onKey(e));

    this.listEl = document.createElement("div");
    this.listEl.setAttribute("role", "listbox");
    this.listEl.style.maxHeight = "48vh";
    this.listEl.style.overflowY = "auto";

    this.footer = document.createElement("div");
    this.footer.className = "kestrel-footer";

    this.panel.append(this.input, this.listEl, this.footer);
  }

  /** Open the overlay, load data in the background, resolve on dismissal. */
  open(): Promise<OmnibarResult> {
    if (this.prefill) {
      this.input.value = this.prefill;
      // Put the caret at the end so typing appends to the seeded text.
      this.input.setSelectionRange(this.prefill.length, this.prefill.length);
    }
    this.render();
    this.focusFirst();
    const promise = new Promise<OmnibarResult>((resolve) => {
      this.resolver = resolve;
    });
    void this.hydrate();
    return promise;
  }

  private async hydrate(): Promise<void> {
    perfStart("omnibar.load");
    // D16: only fetch what this scope renders.
    this.sources = await loadSources(this.scope);
    perfEnd("omnibar.load");
    // The overlay may have been dismissed while the query was in flight.
    if (this.resolver) this.render();
  }

  private rank(): OmnibarItem[] {
    const query = this.input.value;
    if (this.scope === "tabs") {
      return rankItems({ ...EMPTY_SOURCES, tabs: this.sources.tabs }, query, this.settings)
        .filter((i) => i.kind === "tab")
        .slice(0, MAX_RESULTS);
    }
    if (this.scope === "bookmarks") {
      return rankItems(this.sources, query, this.settings)
        .filter((i) => i.kind === "bookmark")
        .slice(0, MAX_RESULTS);
    }
    return rankItems(this.sources, query, this.settings).slice(0, MAX_RESULTS);
  }

  private render(): void {
    perfStart("omnibar.render");
    this.items = this.rank();
    this.listEl.replaceChildren();

    if (this.items.length === 0) {
      const empty = document.createElement("div");
      empty.className = "kestrel-row kestrel-muted";
      empty.textContent = this.sources.tabs.length || this.sources.history.length
        ? "No matches."
        : "Start typing to search history, bookmarks and tabs.";
      this.listEl.appendChild(empty);
    }

    this.items.forEach((item, i) => {
      const row = document.createElement("div");
      row.className = "kestrel-row";
      row.setAttribute("role", "option");
      row.setAttribute("aria-selected", String(i === this.active));

      const text = document.createElement("div");
      text.style.flex = "1";
      text.style.minWidth = "0";
      const title = document.createElement("div");
      title.className = "kestrel-omnibar-title";
      title.textContent = item.title || item.url;
      const detail = document.createElement("div");
      detail.className = "kestrel-muted kestrel-omnibar-url";
      detail.textContent = item.url;
      text.append(title, detail);

      const badge = document.createElement("span");
      badge.className = "kestrel-badge";
      badge.textContent = item.detail;

      row.append(text, badge);
      row.addEventListener("mouseenter", () => {
        this.active = i;
        this.render();
      });
      row.addEventListener("mousedown", (e) => {
        e.preventDefault();
        this.choose(item, this.openInNewTabDefault || e.ctrlKey || e.metaKey);
      });
      this.listEl.appendChild(row);
    });

    this.input.setAttribute(
      "aria-activedescendant",
      this.items.length ? `${this.overlayId()}-opt-${this.active}` : "",
    );
    this.renderFooter();
    perfEnd("omnibar.render");
  }

  private renderFooter(): void {
    this.footer.replaceChildren();
    const left = document.createElement("span");
    const item = this.items[this.active];
    left.textContent = this.scope === "tabs"
      ? `${this.items.length} tab${this.items.length === 1 ? "" : "s"}`
      : item
        ? item.detail
        : engineHint(this.settings.searchEngines);
    const right = document.createElement("span");
    right.textContent = "↵ open · Ctrl+↵ new tab · Esc";
    this.footer.append(left, right);
  }

  private onKey(e: KeyboardEvent): void {
    if (e.key === "Enter") {
      e.preventDefault();
      const item = this.items[this.active] ?? this.items[0];
      if (item) this.choose(item, this.openInNewTabDefault || e.ctrlKey || e.metaKey);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (this.items.length) this.active = Math.min(this.active + 1, this.items.length - 1);
      this.render();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      this.active = Math.max(this.active - 1, 0);
      this.render();
    }
  }

  private choose(item: OmnibarItem, newTab: boolean): void {
    if (item.kind === "tab" && item.tabId != null && !newTab) {
      this.close();
      this.settle({ action: "activateTab", tabId: item.tabId, openInNewTab: false });
      return;
    }
    const url = item.kind === "url" ? toNavigableUrl(item.url) : item.url;
    this.close();
    this.settle({ action: "navigate", url, openInNewTab: newTab });
  }

  private settle(result: OmnibarResult): void {
    const resolve = this.resolver;
    if (!resolve) return;
    this.resolver = null;
    resolve(result);
  }

  private overlayId(): string {
    return this.scope === "tabs" ? DOM_IDS.tabSearch : DOM_IDS.omnibar;
  }
}

/** Convenience factory for the tab-search overlay. */
export function createTabSearch(
  settings: ExtensionSettings,
  prefill = "",
): OmnibarController {
  return new OmnibarController(settings, "tabs", false, prefill);
}

/** Apply an omnibar result: navigate the page or focus an existing tab. */
export function applyOmnibarResult(result: OmnibarResult): void {
  if (result.action === "activateTab" && result.tabId != null) {
    notifyBackground({ type: "tab:activate", tabId: result.tabId });
    return;
  }
  if (result.action === "navigate" && result.url) {
    if (result.openInNewTab) {
      window.open(result.url, "_blank", "noopener");
    } else {
      location.href = result.url;
    }
  }
}
