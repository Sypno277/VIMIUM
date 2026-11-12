import { COMMANDS } from "../commands/commands";
import { fuzzyMatch } from "../omnibar/fuzzy";
import type { CommandDef, ExtensionSettings } from "../types";

import { DOM_IDS } from "./dom-ids";
import { Modal } from "./modal";

// `?` cheat sheet: categorized, searchable overlay of every command and its
// current binding.
//
// §3.3: pressing `?` twice used to stack orphaned overlays and Escape did
// nothing; it now extends Modal (Escape + backdrop + focus trap) and the
// controller owns the toggle. §3.17: rows are built with createElement and
// textContent — no innerHTML, no hand-rolled escaper.

export class CheatSheet extends Modal {
  private readonly search: HTMLInputElement;
  private readonly body: HTMLElement;
  private readonly settings: ExtensionSettings;

  constructor(settings: ExtensionSettings, onClose?: () => void) {
    super(
      {
        id: DOM_IDS.cheatSheet,
        ariaLabel: "Keyboard shortcuts",
        onDismiss: () => onClose?.(),
      },
      settings,
    );
    this.settings = settings;

    this.panel.style.width = "min(760px, 92vw)";
    this.panel.style.maxHeight = "86vh";
    this.panel.style.marginTop = "7vh";
    this.panel.style.display = "flex";
    this.panel.style.flexDirection = "column";

    const title = document.createElement("h2");
    title.textContent = "Keyboard shortcuts";
    Object.assign(title.style, {
      margin: "0",
      padding: "16px 18px 8px",
      fontSize: "16px",
    });

    this.search = document.createElement("input");
    this.search.type = "text";
    this.search.className = "kestrel-input";
    this.search.placeholder = "Search commands…";
    this.search.setAttribute("aria-label", "Search commands");
    this.search.addEventListener("input", () => this.render(this.search.value));

    this.body = document.createElement("div");
    this.body.style.overflowY = "auto";
    this.body.style.padding = "4px 8px 16px";

    this.panel.append(title, this.search, this.body);
    this.render("");
    this.focusFirst();
  }

  private render(query: string): void {
    this.body.replaceChildren();
    const groups = new Map<string, CommandDef[]>();
    for (const cmd of COMMANDS) {
      if (query && !fuzzyMatch(query, cmd.label + " " + cmd.name).matched) continue;
      const list = groups.get(cmd.category) ?? [];
      list.push(cmd);
      groups.set(cmd.category, list);
    }

    if (groups.size === 0) {
      const empty = document.createElement("div");
      empty.className = "kestrel-muted";
      empty.style.padding = "12px";
      empty.textContent = "No matching commands.";
      this.body.appendChild(empty);
      return;
    }

    for (const [category, cmds] of groups) {
      const heading = document.createElement("h3");
      heading.textContent = category.toUpperCase();
      Object.assign(heading.style, {
        color: "var(--k-accent)",
        margin: "14px 10px 6px",
        fontSize: "12px",
        letterSpacing: "0.06em",
      });
      this.body.appendChild(heading);

      for (const cmd of cmds) {
        const row = document.createElement("div");
        row.className = "kestrel-row";
        row.style.cursor = "default";

        const label = document.createElement("span");
        label.textContent = cmd.label;
        label.style.flex = "1";

        const keys = document.createElement("code");
        keys.textContent = this.settings.keymap[cmd.name]?.join(", ") ?? "—";
        keys.style.color = "var(--k-accent)";
        keys.style.fontFamily = "monospace";

        row.append(label, keys);
        this.body.appendChild(row);
      }
    }
  }
}
