import { COMMANDS } from "../../commands/commands";
import { findConflicts } from "../../keymap/conflicts";
import { settingsStore } from "../../storage/storage";
import type { CommandName } from "../../types";

import { button, card, el, getSettings } from "./shared";
import { captureChord } from "./sites-tab";

// Visual key-binding editor with live conflict detection. The search text is
// held in a module variable so a settings write (which re-renders the list)
// never discards what the user was typing (§3.16 #1).
//
// D11: rebinding uses the shared multi-chord capture, so `g g`, `z Shift+H` and
//      `y y` — a third of the default keymap — can be authored in the UI.
//      "Add chord" appends a second binding instead of overwriting the first.

let query = "";

export function renderBindings(root: HTMLElement): void {
  root.replaceChildren();

  const search = el("input", {
    type: "text",
    class: "search",
    placeholder: "Search commands…",
    value: query,
  });
  search.setAttribute("aria-label", "Search commands");
  search.addEventListener("input", () => {
    query = search.value;
    drawList(list, query);
  });

  const list = el("div");
  root.append(card("Key bindings", [search, list]));
  drawList(list, query);
}

function drawList(list: HTMLElement, q: string): void {
  const settings = getSettings();
  list.replaceChildren();

  const conflicts = findConflicts(settings.keymap);
  const conflicted = new Set(conflicts.flatMap((c) => c.commands));
  const needle = q.toLowerCase();
  const matches = COMMANDS.filter(
    (c) => !needle || c.label.toLowerCase().includes(needle) || c.name.includes(needle),
  );

  if (matches.length === 0) {
    list.append(el("p", { class: "hint-spam" }, ["No matching commands."]));
    return;
  }

  for (const command of matches) {
    const chords = settings.keymap[command.name] ?? [];
    const row = el("div", { class: "row" });
    row.append(el("label", { class: "cmd-label" }, [command.label]));

    const keys = el("span", { class: "keys" });
    if (chords.length === 0) {
      keys.append(el("span", { class: "kbd muted" }, ["unbound"]));
    } else {
      for (const chord of chords) keys.append(el("span", { class: "kbd" }, [chord]));
    }
    if (conflicted.has(command.name)) {
      const conflict = conflicts.find((c) => c.commands.includes(command.name));
      keys.append(
        el("span", { class: "conflict" }, [`conflicts with ${conflict?.commands.join(", ")}`]),
      );
    }
    row.append(keys);

    const rebind = button("Rebind", "ghost", () => {
      captureChord(rebind, (chord) => {
        void settingsStore.update((s) => {
          s.keymap[command.name] = [chord];
        });
      });
    });
    const addChord = button("Add chord", "ghost", () => {
      captureChord(addChord, (chord) => {
        void settingsStore.update((s) => {
          const existing = s.keymap[command.name] ?? [];
          if (!existing.includes(chord)) s.keymap[command.name] = [...existing, chord];
        });
      });
    });
    const clear = button("Clear", "ghost", () =>
      settingsStore.update((s) => {
        delete s.keymap[command.name];
      }),
    );

    row.append(rebind, addChord, clear);
    list.append(row);
  }
}

/** Exposed for tests: the command names currently bound to `chord`. */
export function commandsForChord(chord: string): CommandName[] {
  const keymap = getSettings().keymap;
  return (Object.entries(keymap) as [CommandName, string[]][])
    .filter(([, chords]) => chords.includes(chord))
    .map(([name]) => name);
}
