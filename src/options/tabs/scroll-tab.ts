import type { ExtensionSettings } from "../../types";

import { card, getSettings, numberRow, toggleRow } from "./shared";

export function renderScroll(root: HTMLElement): void {
  const settings = getSettings();
  root.replaceChildren();

  const wrap = card("Scrolling", [
    numberRow(
      "Step (px)",
      settings.scroll.step,
      (s: ExtensionSettings, v: number) => { s.scroll.step = v; },
    ),
    numberRow(
      "Half-page fraction",
      settings.scroll.halfPageFraction,
      (s: ExtensionSettings, v: number) => { s.scroll.halfPageFraction = v; },
      0.05,
    ),
    numberRow(
      "Full-page fraction",
      settings.scroll.fullPageFraction,
      (s: ExtensionSettings, v: number) => { s.scroll.fullPageFraction = v; },
      0.05,
    ),
    numberRow(
      "Smooth duration (ms)",
      settings.scroll.smoothDuration,
      (s: ExtensionSettings, v: number) => { s.scroll.smoothDuration = v; },
      10,
    ),
    numberRow(
      "Acceleration",
      settings.scroll.acceleration,
      (s: ExtensionSettings, v: number) => { s.scroll.acceleration = v; },
      0.1,
    ),
    toggleRow(
      "Respect prefers-reduced-motion",
      settings.scroll.respectReducedMotion,
      (s: ExtensionSettings, v: boolean) => { s.scroll.respectReducedMotion = v; },
    ),
  ]);

  root.append(wrap);
}
