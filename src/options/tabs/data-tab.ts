import { parseVimiumConfig } from "../../migration/vimium";
import { DEFAULT_SETTINGS } from "../../settings/settings";
import { settingsStore } from "../../storage/storage";
import type { ExtensionSettings } from "../../types";

import { button, card, el, getSettings, paragraph } from "./shared";

export function renderData(root: HTMLElement): void {
  const settings = getSettings();
  root.replaceChildren();

  const tipEl = el("div", { class: "tip" });
  function setTip(msg: string, isError = false): void {
    tipEl.textContent = msg;
    tipEl.style.color = isError ? "var(--danger)" : "var(--ok)";
  }

  const ta = el("textarea", {
    placeholder: "Paste JSON settings or Vimium mappings here...",
    rows: 12,
  });
  ta.value = JSON.stringify(settings, null, 2);

  const exportBtn = button("Export to clipboard", "primary", async () => {
    try {
      await navigator.clipboard.writeText(ta.value);
      setTip("Copied settings JSON to clipboard.");
    } catch {
      setTip("Clipboard copy failed — please select and copy manually.", true);
    }
  });

  const importBtn = button("Import JSON", "ghost", async () => {
    try {
      const parsed = JSON.parse(ta.value) as Partial<ExtensionSettings>;
      if (typeof parsed !== "object" || parsed === null) {
        throw new Error("Invalid format: expected a JSON object");
      }
      await settingsStore.save(parsed as ExtensionSettings);
      setTip("Successfully imported JSON settings.");
    } catch (err) {
      setTip(`Import failed: ${err instanceof Error ? err.message : String(err)}`, true);
    }
  });

  const vimiumBtn = button("Import Vimium config", "ghost", async () => {
    const text = ta.value;
    if (!text.trim()) {
      setTip("Please paste Vimium 'Custom key mappings' in the text area above.", true);
      return;
    }
    const currentKeymap = getSettings().keymap;
    const result = parseVimiumConfig(text, currentKeymap);
    if (result.imported === 0 && result.skipped.length === 0) {
      setTip("No Vimium mapping directives found. Paste lines like 'map j scrollDown'.", true);
      return;
    }

    await settingsStore.update((s) => {
      s.keymap = result.keymap;
    });

    let msg = `Vimium import: ${result.imported} bindings applied.`;
    if (result.skipped.length > 0) {
      msg += ` (${result.skipped.length} lines skipped/unsupported)`;
    }
    setTip(msg);
  });

  const resetBtn = button("Reset to defaults", "ghost", async () => {
    const ok = window.confirm("Reset all Kestrel settings to factory defaults? This cannot be undone.");
    if (!ok) return;
    await settingsStore.save(DEFAULT_SETTINGS);
    ta.value = JSON.stringify(DEFAULT_SETTINGS, null, 2);
    setTip("Settings reset to defaults.");
  });

  const buttonsRow = el("div", { class: "row", style: "gap: 8px; margin-top: 12px;" }, [
    exportBtn,
    importBtn,
    vimiumBtn,
    resetBtn,
  ]);

  const wrap = card("Import / Export & Migration", [
    paragraph(
      "Settings sync automatically across devices. You can also export/import full JSON configs or migrate from Vimium.",
    ),
    ta,
    buttonsRow,
    tipEl,
  ]);

  root.append(wrap);
}
