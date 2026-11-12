import type { ExtensionSettings } from "../../types";

import { card, getSettings, toggleRow } from "./shared";

export function renderAccess(root: HTMLElement): void {
  const settings = getSettings();
  root.replaceChildren();

  const wrap = card("Accessibility & theming", [
    toggleRow(
      "High-contrast hints",
      settings.hints.highContrast,
      (s: ExtensionSettings, v: boolean) => { s.hints.highContrast = v; },
    ),
    toggleRow(
      "Colorblind-safe palette",
      settings.hints.colorblindSafe,
      (s: ExtensionSettings, v: boolean) => { s.hints.colorblindSafe = v; },
    ),
    toggleRow(
      "Respect reduced motion",
      settings.scroll.respectReducedMotion,
      (s: ExtensionSettings, v: boolean) => { s.scroll.respectReducedMotion = v; },
    ),
  ]);

  root.append(wrap);
}
