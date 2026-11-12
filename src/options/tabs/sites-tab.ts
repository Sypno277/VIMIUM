import { COMMANDS } from "../../commands/commands";
import { tokenFromEvent } from "../../keymap/tokens";
import { BUILTIN_PROFILES } from "../../settings/builtin-profiles";
import { settingsStore } from "../../storage/storage";
import type { CommandName, ExtensionSettings, SiteProfile } from "../../types";

import { button, card, el, getSettings, paragraph, toggleRow } from "./shared";

// Per-site configuration: the disabled-site off-switch, and a profile editor
// that can express everything the engine supports.
//
// D12: removal is by *value/identity*, not the index captured at render time —
//      a stale index removed the wrong entry from the privacy off-switch.
// D10: `disabledCommands`, `keymapOverrides` and `forceInsertSelectors` are all
//      editable here; previously only a read-only command list was shown.

export function renderSites(root: HTMLElement): void {
  root.replaceChildren();
  root.append(builtinCard(), disabledSitesCard(), customProfilesCard());
}

// ---- built-in profiles ----------------------------------------------------

function builtinCard(): HTMLElement {
  const settings = getSettings();
  const builtinNames = BUILTIN_PROFILES.map((p) => p.name).join(", ");
  return card("Built-in site profiles", [
    toggleRow(
      "Enable built-in profiles",
      settings.useBuiltinProfiles,
      (s: ExtensionSettings, v: boolean) => {
        s.useBuiltinProfiles = v;
      },
    ),
    paragraph(
      `Active on: ${builtinNames}. These prevent conflicts with each site's native keybindings.`,
    ),
  ]);
}

// ---- disabled sites -------------------------------------------------------

function disabledSitesCard(): HTMLElement {
  const settings = getSettings();
  const wrap = card("Disabled sites", [
    paragraph("The extension is completely deactivated on matching domains or path prefixes."),
  ]);

  const input = el("input", {
    type: "text",
    placeholder: "e.g. example.com or news.ycombinator.com",
    style: "min-width: 280px;",
  });
  input.setAttribute("aria-label", "Domain to disable");

  const add = button("Disable site", "primary", () => {
    const value = input.value.trim();
    if (!value) return;
    input.value = "";
    void settingsStore.update((s) => {
      if (!s.disabledSites.includes(value)) s.disabledSites.push(value);
    });
  });
  wrap.append(el("div", { class: "row" }, [input, add]));

  const list = el("div");
  if (settings.disabledSites.length === 0) list.append(paragraph("No sites disabled."));
  for (const site of settings.disabledSites) {
    const nameEl = el("span", {}, [site]);
    nameEl.style.flex = "1";
    const remove = button("Remove", "ghost", () => {
      // D12: value-based removal survives a re-render between paint and click.
      void settingsStore.update((s) => {
        s.disabledSites = s.disabledSites.filter((d) => d !== site);
      });
    });
    list.append(el("div", { class: "row" }, [nameEl, remove]));
  }
  wrap.append(list);
  return wrap;
}

// ---- custom profiles ------------------------------------------------------

function customProfilesCard(): HTMLElement {
  const settings = getSettings();
  const wrap = card("Custom per-site overrides", [
    paragraph(
      "Per-site command exclusions, keymap overrides and force-insert selectors apply on top of the built-in profiles.",
    ),
  ]);

  const matchInput = el("input", {
    type: "text",
    placeholder: "domain (e.g. internal.tool.com)",
    style: "min-width: 280px;",
  });
  matchInput.setAttribute("aria-label", "Domain for the new profile");

  const add = button("Add profile", "primary", () => {
    const value = matchInput.value.trim();
    if (!value) return;
    matchInput.value = "";
    void settingsStore.update((s) => {
      s.siteProfiles.push({ name: value, match: value, disabledCommands: [] });
    });
  });
  wrap.append(el("div", { class: "row" }, [matchInput, add]));

  if (settings.siteProfiles.length === 0) {
    wrap.append(paragraph("No custom profiles yet."));
    return wrap;
  }
  for (const profile of settings.siteProfiles) wrap.append(profileEditor(profile));
  return wrap;
}

/** One editable profile block: identity, disabled commands, overrides, selectors. */
function profileEditor(profile: SiteProfile): HTMLElement {
  const box = el("div", { class: "card" });
  box.style.marginTop = "12px";

  // --- identity + delete
  const nameInput = textField("Name", profile.name, (value) =>
    mutate(profile, (p) => {
      p.name = value;
    }),
  );
  const matchField = textField("Match", profile.match, (value) =>
    mutate(profile, (p) => {
      p.match = value;
    }),
  );
  const remove = button("Delete profile", "ghost", () => {
    // D12: remove by identity, not by an index captured when this row painted.
    void settingsStore.update((s) => {
      s.siteProfiles = s.siteProfiles.filter((p) => p !== profile);
    });
  });
  box.append(el("div", { class: "row" }, [nameInput, matchField, remove]));

  // --- disabled commands
  const disabled = new Set<CommandName>(profile.disabledCommands ?? []);
  const commandList = el("div");
  commandList.style.maxHeight = "180px";
  commandList.style.overflowY = "auto";
  for (const command of COMMANDS) {
    const id = `site-cmd-${profile.match}-${command.name}`.replace(/[^\w-]/g, "_");
    const checkbox = el("input", { type: "checkbox", id });
    checkbox.checked = disabled.has(command.name);
    checkbox.addEventListener("change", () =>
      mutate(profile, (p) => {
        const set = new Set<CommandName>(p.disabledCommands ?? []);
        if (checkbox.checked) set.add(command.name);
        else set.delete(command.name);
        p.disabledCommands = [...set];
      }),
    );
    const row = el("div", { class: "row" }, [
      checkbox,
      el("label", { htmlFor: id }, [command.label]),
    ]);
    row.style.gap = "8px";
    commandList.append(row);
  }
  box.append(el("h3", {}, ["Disabled commands"]), commandList);

  // --- keymap overrides
  const overrides = el("div");
  const entries = Object.entries(profile.keymapOverrides ?? {}) as [CommandName, string[]][];
  if (entries.length === 0) overrides.append(paragraph("No key overrides on this site."));
  for (const [command, chords] of entries) {
    const clear = button("Clear", "ghost", () =>
      mutate(profile, (p) => {
        if (!p.keymapOverrides) return;
        delete p.keymapOverrides[command];
        if (Object.keys(p.keymapOverrides).length === 0) p.keymapOverrides = undefined;
      }),
    );
    overrides.append(
      el("div", { class: "row" }, [
        el("span", {}, [command]),
        el("span", { class: "kbd" }, [chords.join(", ")]),
        clear,
      ]),
    );
  }

  const overrideSelect = el("select");
  overrideSelect.setAttribute("aria-label", "Command to override on this site");
  for (const command of COMMANDS) {
    overrideSelect.append(el("option", { value: command.name, textContent: command.label }));
  }
  const captureBtn = button("Capture chord", "ghost", () => {
    captureChord(captureBtn, (chord) => {
      const command = overrideSelect.value as CommandName;
      mutate(profile, (p) => {
        p.keymapOverrides = { ...(p.keymapOverrides ?? {}), [command]: [chord] };
      });
    });
  });
  overrides.append(el("div", { class: "row" }, [overrideSelect, captureBtn]));
  box.append(el("h3", {}, ["Key overrides"]), overrides);

  // --- force insert selectors
  const selectorInput = el("input", {
    type: "text",
    placeholder: "CSS selector, comma separated",
    value: (profile.forceInsertSelectors ?? []).join(", "),
  });
  selectorInput.setAttribute("aria-label", "Force insert-mode selectors");
  selectorInput.style.minWidth = "280px";
  selectorInput.addEventListener("change", () => {
    const selectors = selectorInput.value
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    mutate(profile, (p) => {
      p.forceInsertSelectors = selectors.length ? selectors : undefined;
    });
  });
  box.append(
    el("h3", {}, ["Force insert mode"]),
    paragraph("Typing inside (or below) these selectors never triggers a shortcut."),
    selectorInput,
  );
  return box;
}

// ---- helpers --------------------------------------------------------------

function textField(
  labelText: string,
  value: string,
  onChange: (value: string) => void,
): HTMLElement {
  const id = `site-field-${Math.random().toString(36).slice(2)}`;
  const input = el("input", { type: "text", value, id });
  input.style.minWidth = "140px";
  input.addEventListener("change", () => onChange(input.value.trim()));
  return el("div", { class: "row" }, [el("label", { htmlFor: id }, [labelText]), input]);
}

/** Read-modify-write one profile through the store (never a whole-object write). */
function mutate(profile: SiteProfile, apply: (p: SiteProfile) => void): void {
  void settingsStore.update((s) => {
    const index = s.siteProfiles.indexOf(profile);
    const target = index >= 0 ? s.siteProfiles[index] : profile;
    apply(target);
  });
}

/**
 * Capture the next keystroke — including a multi-key chord — as one chord
 * string. D11: `g g`, `z Shift+H` and `y y` are now authorable.
 */
export function captureChord(btn: HTMLButtonElement, onChord: (chord: string) => void): void {
  const original = btn.textContent;
  btn.textContent = "Press keys…";
  const tokens: string[] = [];
  let timer: number | undefined;

  const finish = (commit: boolean): void => {
    if (timer) window.clearTimeout(timer);
    window.removeEventListener("keydown", handler, true);
    btn.textContent = original;
    if (commit && tokens.length) onChord(tokens.join(" "));
  };

  const handler = (e: KeyboardEvent): void => {
    e.preventDefault();
    e.stopPropagation();
    if (e.key === "Escape") {
      finish(false);
      return;
    }
    const token = tokenFromEvent(e);
    if (!token) return;
    tokens.push(token);
    btn.textContent = tokens.join(" ");
    // Commit once the user pauses, so `g` then `g` becomes "g g".
    if (timer) window.clearTimeout(timer);
    timer = window.setTimeout(() => finish(true), 600);
    // A modifier-prefixed chord is complete on the first keypress.
    if (/^(Ctrl|Alt|Meta)\+/.test(token)) finish(true);
  };

  window.addEventListener("keydown", handler, true);
}
