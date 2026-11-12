import { resolveCommandLine } from "../commands/arguments";
import { COMMANDS } from "../commands/commands";
import { fuzzyMatch } from "../omnibar/fuzzy";
import type { CommandName, ExtensionSettings } from "../types";

import { DOM_IDS } from "./dom-ids";
import { Modal } from "./modal";

// `:`-prefixed command line with fuzzy autocomplete and a live doc preview.
//
// §3.1: the old implementation resolved its promise with `{ raw }` inside
// `close()` *before* `choose()` could send the selected command, so picking an
// item did nothing. Settlement and teardown are now separate concerns and the
// promise settles exactly once.

export interface CommandPaletteResult {
  command?: CommandName;
  /** Raw query text (without the leading `:`). */
  raw: string;
  /** Argument for commands that take one (`:tabopen <url>`). */
  args?: string;
}

interface PaletteItem {
  name: CommandName;
  label: string;
  description: string;
  category: string;
}

const MAX_RESULTS = 8;

export class CommandPalette extends Modal {
  private readonly input: HTMLInputElement;
  private readonly listEl: HTMLElement;
  private readonly footer: HTMLElement;
  private readonly items: PaletteItem[];
  private readonly settings: ExtensionSettings;
  private active = 0;
  private resolver: ((r: CommandPaletteResult) => void) | null = null;

  constructor(settings: ExtensionSettings) {
    super(
      {
        id: DOM_IDS.palette,
        ariaLabel: "Command palette",
        onDismiss: () => this.settle({ raw: this.currentRaw() }),
      },
      settings,
    );
    this.settings = settings;
    this.items = COMMANDS.map((c) => ({
      name: c.name,
      label: c.label,
      description: c.description,
      category: c.category,
    }));

    this.panel.style.width = "min(620px, 92vw)";
    this.panel.style.marginTop = "10vh";

    this.input = document.createElement("input");
    this.input.id = DOM_IDS.paletteInput;
    this.input.className = "kestrel-input";
    this.input.type = "text";
    this.input.placeholder = "Type a command, a URL, or ':tabopen <url>'…";
    this.input.setAttribute("aria-label", "Command");
    this.input.setAttribute("role", "combobox");
    this.input.setAttribute("aria-expanded", "true");
    this.input.setAttribute("aria-controls", DOM_IDS.palette + "-list");
    this.input.addEventListener("input", () => {
      this.active = 0;
      this.render();
    });
    this.input.addEventListener("keydown", (e) => this.onKey(e));

    this.listEl = document.createElement("div");
    this.listEl.id = DOM_IDS.palette + "-list";
    this.listEl.setAttribute("role", "listbox");
    this.listEl.style.maxHeight = "46vh";
    this.listEl.style.overflowY = "auto";

    this.footer = document.createElement("div");
    this.footer.className = "kestrel-footer";

    this.panel.append(this.input, this.listEl, this.footer);
  }

  /** Open the palette and resolve with the chosen command (or `{ raw }`). */
  open(): Promise<CommandPaletteResult> {
    this.render();
    this.focusFirst();
    return new Promise((resolve) => {
      this.resolver = resolve;
    });
  }

  private get matches(): PaletteItem[] {
    const text = this.input.value.trim();
    const line = resolveCommandLine(text, this.settings);

    // An explicit command line (verb or URL) short-circuits the fuzzy list.
    if (line.command) {
      const def = this.items.find((i) => i.name === line.command);
      return def ? [def] : [];
    }

    const q = text.replace(/^:/, "").trim();
    if (!q) return this.items.slice(0, MAX_RESULTS);
    return this.items
      .map((it) => ({ it, r: fuzzyMatch(q, it.label + " " + it.name + " " + it.category) }))
      .filter((x) => x.r.matched)
      .sort((a, b) => b.r.score - a.r.score)
      .slice(0, MAX_RESULTS)
      .map((x) => x.it);
  }

  private render(): void {
    const items = this.matches;
    this.listEl.replaceChildren();
    items.forEach((it, i) => {
      const row = document.createElement("div");
      row.className = "kestrel-row";
      row.setAttribute("role", "option");
      row.setAttribute("aria-selected", String(i === this.active));
      row.id = `${DOM_IDS.palette}-opt-${i}`;
      const label = document.createElement("span");
      label.textContent = it.label;
      const cat = document.createElement("span");
      cat.className = "kestrel-badge";
      cat.textContent = it.category;
      row.append(label, cat);
      row.addEventListener("mouseenter", () => {
        this.active = i;
        this.render();
      });
      row.addEventListener("mousedown", (e) => {
        e.preventDefault();
        this.choose(it);
      });
      this.listEl.appendChild(row);
    });

    const activeItem = items[this.active];
    const line = resolveCommandLine(this.input.value.trim(), this.settings);
    this.input.setAttribute("aria-activedescendant", items.length ? `${DOM_IDS.palette}-opt-${this.active}` : "");

    const docText = activeItem ? activeItem.description : "No matching command";
    const argText = line.args ? `  ·  arg: ${line.args}` : "";
    this.footer.replaceChildren();
    const left = document.createElement("span");
    left.textContent = docText + argText;
    const right = document.createElement("span");
    right.textContent = "↑↓ · Enter · Esc";
    this.footer.append(left, right);
  }

  private onKey(e: KeyboardEvent): void {
    const items = this.matches;
    if (e.key === "Enter") {
      e.preventDefault();
      const item = items[this.active] ?? items[0];
      if (item) this.choose(item);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (items.length) this.active = Math.min(this.active + 1, items.length - 1);
      this.render();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      this.active = Math.max(this.active - 1, 0);
      this.render();
    }
  }

  /** Commit a choice: tear down the DOM, then settle exactly once. */
  private choose(item: PaletteItem): void {
    const raw = this.currentRaw();
    const line = resolveCommandLine(this.input.value.trim(), this.settings);
    this.close();
    this.settle({ command: item.name, raw, args: line.command ? line.args : undefined });
  }

  private settle(result: CommandPaletteResult): void {
    const resolve = this.resolver;
    if (!resolve) return; // already settled — a second call is a no-op
    this.resolver = null;
    resolve(result);
  }

  private currentRaw(): string {
    return this.input.value.replace(/^:/, "").trim();
  }
}
